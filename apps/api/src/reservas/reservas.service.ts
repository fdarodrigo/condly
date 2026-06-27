import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { CriarReservaDto } from './dto/criar-reserva.dto';

export interface RegrasReserva {
  horarioAbertura: string;
  horarioFechamento: string;
  duracaoMinimaMinutos: number;
  antecedenciaMaximaDias: number;
}

export interface Intervalo {
  inicio: Date;
  fim: Date;
}

const REGRAS_PADRAO: RegrasReserva = {
  horarioAbertura: '08:00',
  horarioFechamento: '22:00',
  duracaoMinimaMinutos: 60,
  antecedenciaMaximaDias: 30,
};

function lerRegras(regrasReserva: unknown): RegrasReserva {
  const regras = (regrasReserva ?? {}) as unknown as Partial<RegrasReserva>;
  return {
    horarioAbertura: regras.horarioAbertura ?? REGRAS_PADRAO.horarioAbertura,
    horarioFechamento: regras.horarioFechamento ?? REGRAS_PADRAO.horarioFechamento,
    duracaoMinimaMinutos: regras.duracaoMinimaMinutos ?? REGRAS_PADRAO.duracaoMinimaMinutos,
    antecedenciaMaximaDias: regras.antecedenciaMaximaDias ?? REGRAS_PADRAO.antecedenciaMaximaDias,
  };
}

function horarioParaDate(dataISO: string, horario: string): Date {
  return new Date(`${dataISO}T${horario}:00.000Z`);
}

/**
 * Calcula os intervalos livres dentro do horário de funcionamento, descontando
 * os intervalos ocupados. Gaps menores que a duração mínima configurada são
 * descartados — um buraco de 20 minutos não é "livre" se a reserva mínima é
 * de 60.
 */
function calcularLivres(
  dataISO: string,
  regras: RegrasReserva,
  ocupados: Intervalo[],
): Intervalo[] {
  const aberturaDia = horarioParaDate(dataISO, regras.horarioAbertura);
  const fechamentoDia = horarioParaDate(dataISO, regras.horarioFechamento);

  const ordenados = [...ocupados].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const livres: Intervalo[] = [];
  let cursor = aberturaDia;

  for (const intervalo of ordenados) {
    const inicioOcupado = intervalo.inicio < aberturaDia ? aberturaDia : intervalo.inicio;
    const fimOcupado = intervalo.fim > fechamentoDia ? fechamentoDia : intervalo.fim;

    if (inicioOcupado > cursor) {
      livres.push({ inicio: cursor, fim: inicioOcupado });
    }
    if (fimOcupado > cursor) {
      cursor = fimOcupado;
    }
  }

  if (cursor < fechamentoDia) {
    livres.push({ inicio: cursor, fim: fechamentoDia });
  }

  const duracaoMinimaMs = regras.duracaoMinimaMinutos * 60_000;
  return livres.filter(
    (intervalo) => intervalo.fim.getTime() - intervalo.inicio.getTime() >= duracaoMinimaMs,
  );
}

@Injectable()
export class ReservasService {
  /**
   * Listagem simples (id + nome) pra sustentar o seletor de área comum da
   * tela de reservas (Prompt 10.5) — não existia nenhum endpoint de leitura
   * de `AreaComum` até aqui (criada só via seed/script, ver CLAUDE.md).
   * Mesmas roles de `disponibilidade`/`criar`: qualquer papel do condomínio
   * pode ver quais áreas existem pra escolher uma.
   */
  async listarAreasComuns(condominioId: string, tenantPrisma: TenantPrismaClient) {
    return tenantPrisma.areaComum.findMany({
      where: { condominioId },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  async disponibilidade(areaComumId: string, data: string, tenantPrisma: TenantPrismaClient) {
    const areaComum = await tenantPrisma.areaComum.findUnique({ where: { id: areaComumId } });
    if (!areaComum) {
      throw new NotFoundException('Área comum não encontrada.');
    }

    const regras = lerRegras(areaComum.regrasReserva);
    const inicioDoDia = new Date(`${data}T00:00:00.000Z`);
    const fimDoDia = new Date(`${data}T23:59:59.999Z`);

    const reservasDoDia = await tenantPrisma.reserva.findMany({
      where: {
        areaComumId,
        status: 'CONFIRMADA',
        inicio: { lt: fimDoDia },
        fim: { gt: inicioDoDia },
      },
      orderBy: { inicio: 'asc' },
    });

    const ocupados = reservasDoDia.map((reserva) => ({ inicio: reserva.inicio, fim: reserva.fim }));
    const livres = calcularLivres(data, regras, ocupados);

    return {
      areaComumId,
      data,
      horarioAbertura: regras.horarioAbertura,
      horarioFechamento: regras.horarioFechamento,
      ocupados,
      livres,
    };
  }

  async criar(
    areaComumId: string,
    dto: CriarReservaDto,
    usuario: AuthenticatedUser,
    tenantPrisma: TenantPrismaClient,
  ) {
    const areaComum = await tenantPrisma.areaComum.findUnique({ where: { id: areaComumId } });
    if (!areaComum) {
      throw new NotFoundException('Área comum não encontrada.');
    }

    // CONDOMINO só reserva em nome da própria unidade — mesmo que informe
    // outro unidadeId no corpo, é ignorado/rejeitado. SINDICO/ADMINISTRADORA
    // precisam informar de qual unidade é a reserva.
    const vinculoCondomino = usuario.vinculos.find(
      (vinculo) => vinculo.papel === 'CONDOMINO' && vinculo.condominioId === areaComum.condominioId,
    );
    const temAcessoAmplo = usuario.vinculos.some(
      (vinculo) =>
        (vinculo.papel === 'SINDICO' && vinculo.condominioId === areaComum.condominioId) ||
        vinculo.papel === 'ADMINISTRADORA',
    );

    let unidadeId: string;
    if (vinculoCondomino && !temAcessoAmplo) {
      if (dto.unidadeId && dto.unidadeId !== vinculoCondomino.unidadeId) {
        throw new ForbiddenException('Condômino só pode reservar em nome da própria unidade.');
      }
      unidadeId = vinculoCondomino.unidadeId!;
    } else {
      if (!dto.unidadeId) {
        throw new BadRequestException('unidadeId é obrigatório.');
      }
      unidadeId = dto.unidadeId;
    }

    const unidade = await tenantPrisma.unidade.findUnique({ where: { id: unidadeId } });
    if (!unidade || unidade.condominioId !== areaComum.condominioId) {
      throw new NotFoundException('Unidade não encontrada neste condomínio.');
    }

    const inicio = new Date(dto.inicio);
    const fim = new Date(dto.fim);

    if (fim <= inicio) {
      throw new BadRequestException('O horário de fim precisa ser depois do horário de início.');
    }
    if (inicio < new Date()) {
      throw new BadRequestException('Não é possível reservar em um horário no passado.');
    }

    const regras = lerRegras(areaComum.regrasReserva);
    const duracaoMinutos = (fim.getTime() - inicio.getTime()) / 60_000;
    if (duracaoMinutos < regras.duracaoMinimaMinutos) {
      throw new BadRequestException(
        `A reserva precisa ter ao menos ${regras.duracaoMinimaMinutos} minutos.`,
      );
    }

    const limiteAntecedencia = new Date();
    limiteAntecedencia.setUTCDate(limiteAntecedencia.getUTCDate() + regras.antecedenciaMaximaDias);
    if (inicio > limiteAntecedencia) {
      throw new BadRequestException(
        `Não é possível reservar com mais de ${regras.antecedenciaMaximaDias} dias de antecedência.`,
      );
    }

    const dataDaReserva = dto.inicio.slice(0, 10);
    const aberturaDia = horarioParaDate(dataDaReserva, regras.horarioAbertura);
    const fechamentoDia = horarioParaDate(dataDaReserva, regras.horarioFechamento);
    if (inicio < aberturaDia || fim > fechamentoDia) {
      throw new BadRequestException(
        `A área só pode ser reservada entre ${regras.horarioAbertura} e ${regras.horarioFechamento}.`,
      );
    }

    // Conflito: qualquer reserva CONFIRMADA da mesma área cujo intervalo se
    // sobreponha ao solicitado, independente de qual unidade a fez — é por
    // isso que esta rota é aninhada em /areas-comuns/:areaComumId (escopo
    // condominioId), não em /unidades/:unidadeId — senão o filtro físico do
    // tenant restringiria essa busca só às reservas da própria unidade.
    const conflito = await tenantPrisma.reserva.findFirst({
      where: {
        areaComumId,
        status: 'CONFIRMADA',
        inicio: { lt: fim },
        fim: { gt: inicio },
      },
    });

    if (conflito) {
      const reservasDoDia = await tenantPrisma.reserva.findMany({
        where: {
          areaComumId,
          status: 'CONFIRMADA',
          inicio: { lt: fechamentoDia },
          fim: { gt: aberturaDia },
        },
      });
      const ocupados = reservasDoDia.map((r) => ({ inicio: r.inicio, fim: r.fim }));
      // Ordena por proximidade ao horário pedido (não cronologicamente do
      // início do dia) — "mais próximos" é em relação ao que o usuário
      // queria, não necessariamente o primeiro horário livre do dia.
      const sugestoes = calcularLivres(dataDaReserva, regras, ocupados)
        .sort(
          (a, b) =>
            Math.abs(a.inicio.getTime() - inicio.getTime()) -
            Math.abs(b.inicio.getTime() - inicio.getTime()),
        )
        .slice(0, 3);

      throw new ConflictException({
        statusCode: 409,
        message: 'Conflito de horário com uma reserva existente nesta área comum.',
        sugestoes,
      });
    }

    return tenantPrisma.reserva.create({
      data: { areaComumId, unidadeId, inicio, fim, status: 'CONFIRMADA' },
    });
  }

  async cancelar(reservaId: string, tenantPrisma: TenantPrismaClient) {
    const reserva = await tenantPrisma.reserva.findUnique({ where: { id: reservaId } });
    if (!reserva) {
      throw new NotFoundException('Reserva não encontrada.');
    }
    if (reserva.status === 'CANCELADA') {
      throw new BadRequestException('Reserva já está cancelada.');
    }

    return tenantPrisma.reserva.update({
      where: { id: reservaId },
      data: { status: 'CANCELADA' },
    });
  }
}
