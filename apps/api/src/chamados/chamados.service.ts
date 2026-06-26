import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantPrismaClient } from '../prisma/tenant-prisma';
import { AuthenticatedUser } from '../auth/types/auth.types';
import { StatusChamado } from '../../generated/prisma/client';
import { CriarChamadoDto } from './dto/criar-chamado.dto';
import { AtualizarChamadoDto } from './dto/atualizar-chamado.dto';
import {
  CHAMADO_STATUS_ALTERADO,
  ChamadoStatusAlteradoEvent,
} from './events/chamado-status-alterado.event';
import { CHAMADO_REABERTO, ChamadoReabertoEvent } from './events/chamado-reaberto.event';

// Lista de permissão explícita: qualquer transição não listada aqui é
// rejeitada, incluindo pares "razoáveis" como PENDENTE_TRIAGEM →
// EM_ANDAMENTO (pular a triagem não é permitido mesmo indiretamente).
const TRANSICOES_VALIDAS: Record<StatusChamado, StatusChamado[]> = {
  PENDENTE_TRIAGEM: ['ABERTO'],
  ABERTO: ['EM_ANDAMENTO'],
  EM_ANDAMENTO: ['RESOLVIDO'],
  RESOLVIDO: ['ABERTO'],
};

@Injectable()
export class ChamadosService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Status inicial depende de quem abre: síndico abre já como ABERTO,
   * condômino entra como PENDENTE_TRIAGEM até o síndico classificar. Quando
   * o usuário tem ambos os vínculos para este condomínio (caso raro),
   * síndico prevalece — é o papel com mais autoridade sobre o chamado.
   */
  async abrirChamado(
    condominioId: string,
    dto: CriarChamadoDto,
    usuario: AuthenticatedUser,
    tenantPrisma: TenantPrismaClient,
  ) {
    const abrePorSindico = usuario.vinculos.some(
      (vinculo) => vinculo.papel === 'SINDICO' && vinculo.condominioId === condominioId,
    );
    const vinculoCondomino = usuario.vinculos.find(
      (vinculo) => vinculo.papel === 'CONDOMINO' && vinculo.condominioId === condominioId,
    );

    const unidadeId = dto.unidadeId ?? vinculoCondomino?.unidadeId;
    if (unidadeId) {
      const unidade = await tenantPrisma.unidade.findUnique({ where: { id: unidadeId } });
      if (!unidade || unidade.condominioId !== condominioId) {
        throw new NotFoundException('Unidade não encontrada neste condomínio.');
      }
    }

    const status: StatusChamado = abrePorSindico ? 'ABERTO' : 'PENDENTE_TRIAGEM';

    const chamado = await tenantPrisma.chamado.create({
      data: {
        condominioId,
        unidadeId,
        abertoPorId: usuario.usuarioId,
        categoria: dto.categoria,
        status,
      },
    });

    this.emitirMudancaDeStatus(chamado.id, condominioId, null, status);

    return chamado;
  }

  /**
   * ADMINISTRADORA e SINDICO (do próprio condomínio) veem todos os
   * chamados. CONDOMINO só vê os que abriu ou que pertencem à própria
   * unidade — nunca chamados de outras unidades do mesmo condomínio,
   * mesmo que o vínculo dele autorize o acesso à rota (nível condomínio).
   */
  async listar(
    condominioId: string,
    status: StatusChamado | undefined,
    usuario: AuthenticatedUser,
    tenantPrisma: TenantPrismaClient,
  ) {
    const temVinculoAdministradora = usuario.vinculos.some(
      (vinculo) => vinculo.papel === 'ADMINISTRADORA',
    );
    // Só busca o condomínio se houver um vínculo ADMINISTRADORA a verificar —
    // evita a query extra no caso comum (SINDICO/CONDOMINO já resolvem por
    // condominioId direto, sem precisar saber a administradoraId).
    const administradoraIdDoCondominio = temVinculoAdministradora
      ? (await tenantPrisma.condominio.findUnique({ where: { id: condominioId } }))
          ?.administradoraId
      : undefined;

    const vinculoAmplo = usuario.vinculos.some((vinculo) => {
      if (vinculo.papel === 'SINDICO') {
        return vinculo.condominioId === condominioId;
      }
      if (vinculo.papel === 'ADMINISTRADORA') {
        return vinculo.administradoraId === administradoraIdDoCondominio;
      }
      return false;
    });

    const vinculoCondomino = usuario.vinculos.find(
      (vinculo) => vinculo.papel === 'CONDOMINO' && vinculo.condominioId === condominioId,
    );

    const filtroVisibilidade =
      !vinculoAmplo && vinculoCondomino
        ? {
            OR: [{ abertoPorId: usuario.usuarioId }, { unidadeId: vinculoCondomino.unidadeId }],
          }
        : {};

    return tenantPrisma.chamado.findMany({
      where: { condominioId, ...(status ? { status } : {}), ...filtroVisibilidade },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizar(chamadoId: string, dto: AtualizarChamadoDto, tenantPrisma: TenantPrismaClient) {
    const chamadoAtual = await tenantPrisma.chamado.findUnique({ where: { id: chamadoId } });
    if (!chamadoAtual) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    if (dto.responsavelId) {
      // `Usuario` não tem administradoraId/condominioId direto — sem essa
      // checagem manual, qualquer Usuario existente no banco (de qualquer
      // tenant) seria aceito como responsável, já que `usuario` não está em
      // CONDOMINIO_ID_MODELS/UNIDADE_ID_MODELS do filtro físico.
      const condominio = await tenantPrisma.condominio.findUnique({
        where: { id: chamadoAtual.condominioId },
      });
      const vinculo = await tenantPrisma.vinculoUsuario.findFirst({
        where: {
          usuarioId: dto.responsavelId,
          OR: [
            { condominioId: chamadoAtual.condominioId },
            { administradoraId: condominio?.administradoraId },
            { unidade: { condominioId: chamadoAtual.condominioId } },
          ],
        },
      });
      if (!vinculo) {
        throw new BadRequestException(
          'O usuário responsável precisa ter vínculo com o condomínio deste chamado.',
        );
      }
    }

    let ehReabertura = false;
    if (dto.status) {
      if (dto.status === chamadoAtual.status) {
        throw new BadRequestException(`O chamado já está com status ${dto.status}.`);
      }
      if (!TRANSICOES_VALIDAS[chamadoAtual.status].includes(dto.status)) {
        throw new BadRequestException(
          `Transição de status inválida: ${chamadoAtual.status} → ${dto.status}.`,
        );
      }
      ehReabertura = chamadoAtual.status === 'RESOLVIDO' && dto.status === 'ABERTO';
    }

    const chamadoAtualizado = await tenantPrisma.chamado.update({
      where: { id: chamadoId },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.categoria ? { categoria: dto.categoria } : {}),
        ...(dto.responsavelId !== undefined ? { responsavelId: dto.responsavelId } : {}),
        ...(ehReabertura ? { reabertoEm: new Date() } : {}),
      },
    });

    if (dto.status) {
      this.emitirMudancaDeStatus(
        chamadoId,
        chamadoAtual.condominioId,
        chamadoAtual.status,
        dto.status,
      );
      if (ehReabertura) {
        this.emitirReabertura(chamadoId, chamadoAtual.condominioId, chamadoAtualizado.reabertoEm!);
      }
    }

    return chamadoAtualizado;
  }

  private emitirMudancaDeStatus(
    chamadoId: string,
    condominioId: string,
    statusAnterior: StatusChamado | null,
    statusNovo: StatusChamado,
  ) {
    const evento: ChamadoStatusAlteradoEvent = {
      chamadoId,
      condominioId,
      statusAnterior,
      statusNovo,
    };
    this.eventEmitter.emit(CHAMADO_STATUS_ALTERADO, evento);
  }

  private emitirReabertura(chamadoId: string, condominioId: string, reabertoEm: Date) {
    const evento: ChamadoReabertoEvent = { chamadoId, condominioId, reabertoEm };
    this.eventEmitter.emit(CHAMADO_REABERTO, evento);
  }
}
