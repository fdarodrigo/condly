import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReservasService } from '../../reservas/reservas.service';
import { AuthenticatedUser } from '../../auth/types/auth.types';
import { IdentidadeResolvida } from '../identidade';
import { FluxoReservaEstado, SlotHorario } from './tipos';

const MAX_SLOTS_APRESENTADOS = 12;

export interface PassoFluxo {
  resposta: string;
  /** null = fluxo encerrado (concluído, cancelado ou inviável) */
  fluxo: FluxoReservaEstado | null;
}

function agoraISO(): string {
  return new Date().toISOString();
}

function formatarDataBR(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarHoraUTC(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Interpreta o dia informado pelo usuário: "hoje", "amanhã"/"amanha",
 * DD/MM ou DD/MM/AAAA. Retorna `yyyy-mm-dd` (UTC, mesma convenção das
 * reservas no resto do produto) ou null se não entendeu.
 */
export function interpretarDia(texto: string): string | null {
  const normalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const hoje = new Date();
  const paraISO = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

  if (normalizado === 'hoje') return paraISO(hoje);
  if (normalizado === 'amanha') return paraISO(new Date(hoje.getTime() + 86_400_000));

  const match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(normalizado);
  if (!match) return null;

  const dia = Number(match[1]);
  const mes = Number(match[2]);
  let ano = match[3] ? Number(match[3]) : hoje.getUTCFullYear();
  if (ano < 100) ano += 2000;
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;

  // Sem ano informado e a data já passou este ano → assume o próximo ano
  // (ex: pedir "05/01" em dezembro).
  const candidata = new Date(Date.UTC(ano, mes - 1, dia));
  if (candidata.getUTCDate() !== dia || candidata.getUTCMonth() !== mes - 1) return null;
  if (!match[3]) {
    const hojeISO = paraISO(hoje);
    if (paraISO(candidata) < hojeISO) {
      return paraISO(new Date(Date.UTC(ano + 1, mes - 1, dia)));
    }
  }
  return paraISO(candidata);
}

/**
 * Fluxo multi-turno de reserva de área comum: área → dia → horário →
 * confirmação. A criação em si delega pra ReservasService.criar — as MESMAS
 * regras de negócio da API (conflito, antecedência, horário de
 * funcionamento, condômino só reserva pra própria unidade), nunca uma
 * reimplementação. Toda query aqui é pinada ao condominioId/unidadeId da
 * identidade resolvida pelo telefone — nada vem do texto além de escolhas
 * entre opções que o próprio bot apresentou.
 */
@Injectable()
export class FluxoReservaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservasService: ReservasService,
  ) {}

  async iniciar(
    identidade: IdentidadeResolvida,
    areaComumTexto: string | null,
  ): Promise<PassoFluxo> {
    const areas = await this.prisma.areaComum.findMany({
      where: { condominioId: identidade.condominioId },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });

    if (areas.length === 0) {
      return {
        resposta: 'Seu condomínio ainda não tem nenhuma área comum cadastrada para reserva.',
        fluxo: null,
      };
    }

    // "reservar salão" pula a etapa de escolha da área — o texto é usado só
    // pra BUSCAR entre as áreas do condomínio da identidade, nunca pra
    // decidir autorização.
    if (areaComumTexto) {
      const area = await this.prisma.areaComum.findFirst({
        where: {
          condominioId: identidade.condominioId,
          nome: { contains: areaComumTexto, mode: 'insensitive' },
        },
        select: { id: true, nome: true },
      });
      if (area) {
        return {
          resposta: `Vamos reservar *${area.nome}*! 📅\nPra qual dia? (responda *hoje*, *amanhã* ou uma data como *15/07*)`,
          fluxo: {
            tipo: 'RESERVA',
            etapa: 'DIA',
            atualizadoEm: agoraISO(),
            areaComumId: area.id,
            areaNome: area.nome,
          },
        };
      }
    }

    const lista = areas.map((a, i) => `*${i + 1}* — ${a.nome}`).join('\n');
    return {
      resposta: `Qual área comum você quer reservar? Responda com o número:\n\n${lista}`,
      fluxo: { tipo: 'RESERVA', etapa: 'AREA', atualizadoEm: agoraISO(), areas },
    };
  }

  async processarResposta(
    identidade: IdentidadeResolvida,
    fluxo: FluxoReservaEstado,
    texto: string,
  ): Promise<PassoFluxo> {
    switch (fluxo.etapa) {
      case 'AREA':
        return this.escolherArea(fluxo, texto);
      case 'DIA':
        return this.escolherDia(fluxo, texto);
      case 'HORARIO':
        return this.confirmarHorario(identidade, fluxo, texto);
    }
  }

  private async escolherArea(fluxo: FluxoReservaEstado, texto: string): Promise<PassoFluxo> {
    const areas = fluxo.areas ?? [];
    const numero = /^\s*(\d{1,2})\s*$/.exec(texto);
    let escolhida: { id: string; nome: string } | undefined;

    if (numero) {
      escolhida = areas[Number(numero[1]) - 1];
    } else {
      const nomeNormalizado = texto.trim().toLowerCase();
      escolhida = areas.find((a) => a.nome.toLowerCase().includes(nomeNormalizado));
    }

    if (!escolhida) {
      const lista = areas.map((a, i) => `*${i + 1}* — ${a.nome}`).join('\n');
      return {
        resposta: `Não entendi qual área. Responda com o número de uma das opções:\n\n${lista}`,
        fluxo: { ...fluxo, atualizadoEm: agoraISO() },
      };
    }

    return {
      resposta: `Vamos reservar *${escolhida.nome}*! 📅\nPra qual dia? (responda *hoje*, *amanhã* ou uma data como *15/07*)`,
      fluxo: {
        tipo: 'RESERVA',
        etapa: 'DIA',
        atualizadoEm: agoraISO(),
        areaComumId: escolhida.id,
        areaNome: escolhida.nome,
      },
    };
  }

  private async escolherDia(fluxo: FluxoReservaEstado, texto: string): Promise<PassoFluxo> {
    const dataISO = interpretarDia(texto);
    if (!dataISO) {
      return {
        resposta:
          'Não entendi a data. 🗓 Responda *hoje*, *amanhã* ou uma data como *15/07* (ou *cancelar* pra desistir).',
        fluxo: { ...fluxo, atualizadoEm: agoraISO() },
      };
    }

    return this.apresentarHorarios(fluxo, dataISO);
  }

  /**
   * Consulta a disponibilidade real do dia (mesma lógica da API, via
   * ReservasService.disponibilidade) e fatia os intervalos livres em slots
   * do tamanho da duração mínima da área.
   */
  private async apresentarHorarios(
    fluxo: FluxoReservaEstado,
    dataISO: string,
  ): Promise<PassoFluxo> {
    const area = await this.prisma.areaComum.findUnique({
      where: { id: fluxo.areaComumId! },
      select: { regrasReserva: true },
    });
    const regras = (area?.regrasReserva ?? {}) as { duracaoMinimaMinutos?: number };
    const duracaoMinutos = regras.duracaoMinimaMinutos ?? 60;

    const disponibilidade = await this.reservasService.disponibilidade(
      fluxo.areaComumId!,
      dataISO,
      this.prisma,
    );

    const agora = new Date();
    const slots: SlotHorario[] = [];
    for (const livre of disponibilidade.livres) {
      let cursor = new Date(livre.inicio);
      const fimLivre = new Date(livre.fim);
      while (cursor.getTime() + duracaoMinutos * 60_000 <= fimLivre.getTime()) {
        const fimSlot = new Date(cursor.getTime() + duracaoMinutos * 60_000);
        // hoje: não oferece horário que já passou
        if (cursor > agora) {
          slots.push({ inicio: cursor.toISOString(), fim: fimSlot.toISOString() });
        }
        cursor = fimSlot;
      }
    }

    if (slots.length === 0) {
      return {
        resposta: `Não há horários livres em *${fluxo.areaNome}* no dia ${formatarDataBR(dataISO)}. 😕 Quer tentar outro dia? (responda com a data, ou *cancelar*)`,
        fluxo: { ...fluxo, etapa: 'DIA', atualizadoEm: agoraISO() },
      };
    }

    const apresentados = slots.slice(0, MAX_SLOTS_APRESENTADOS);
    const lista = apresentados
      .map((s, i) => `*${i + 1}* — ${formatarHoraUTC(s.inicio)} às ${formatarHoraUTC(s.fim)}`)
      .join('\n');

    return {
      resposta: `Horários livres em *${fluxo.areaNome}* no dia ${formatarDataBR(dataISO)}:\n\n${lista}\n\nResponda com o número do horário pra confirmar.`,
      fluxo: {
        tipo: 'RESERVA',
        etapa: 'HORARIO',
        atualizadoEm: agoraISO(),
        areaComumId: fluxo.areaComumId,
        areaNome: fluxo.areaNome,
        dataISO,
        slots: apresentados,
      },
    };
  }

  private async confirmarHorario(
    identidade: IdentidadeResolvida,
    fluxo: FluxoReservaEstado,
    texto: string,
  ): Promise<PassoFluxo> {
    // Aceita também uma nova data nesta etapa ("quero outro dia: 20/07")
    const outraData = interpretarDia(texto);
    if (outraData) {
      return this.apresentarHorarios(fluxo, outraData);
    }

    const numero = /^\s*(\d{1,2})\s*$/.exec(texto);
    const slot = numero ? fluxo.slots?.[Number(numero[1]) - 1] : undefined;
    if (!slot) {
      return {
        resposta:
          'Não entendi. Responda com o *número* de um dos horários da lista, uma nova data (ex: *20/07*) ou *cancelar*.',
        fluxo: { ...fluxo, atualizadoEm: agoraISO() },
      };
    }

    // A criação passa pelo MESMO ReservasService da API: valida passado,
    // antecedência, horário de funcionamento e conflito (à prova de corrida
    // — se alguém reservou entre a listagem e a confirmação, cai no catch).
    // O "usuário autenticado" é montado a partir da identidade resolvida
    // pelo telefone — nunca do texto.
    const usuarioBot: AuthenticatedUser = {
      usuarioId: identidade.usuarioId,
      vinculos: [
        {
          papel: 'CONDOMINO',
          condominioId: identidade.condominioId,
          unidadeId: identidade.unidadeId,
        },
      ],
    };

    try {
      await this.reservasService.criar(
        fluxo.areaComumId!,
        { inicio: slot.inicio, fim: slot.fim },
        usuarioBot,
        this.prisma,
      );
    } catch (excecao) {
      if (excecao instanceof ConflictException) {
        // corrida: alguém confirmou esse horário primeiro — reapresenta o dia
        const denovo = await this.apresentarHorarios(fluxo, fluxo.dataISO!);
        return {
          resposta: `Esse horário acabou de ser reservado por outra unidade. 😕\n\n${denovo.resposta}`,
          fluxo: denovo.fluxo,
        };
      }
      if (excecao instanceof HttpException) {
        return {
          resposta: `Não consegui confirmar: ${excecao.message} Tente outro horário ou responda *cancelar*.`,
          fluxo: { ...fluxo, atualizadoEm: agoraISO() },
        };
      }
      throw excecao;
    }

    return {
      resposta:
        `Reserva confirmada! ✅\n*${fluxo.areaNome}* — ${formatarDataBR(fluxo.dataISO!)}, das ` +
        `${formatarHoraUTC(slot.inicio)} às ${formatarHoraUTC(slot.fim)}.\n` +
        'Você pode consultar ou cancelar pelo app do Condly.',
      fluxo: null,
    };
  }
}
