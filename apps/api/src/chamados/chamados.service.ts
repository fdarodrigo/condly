import { Injectable, NotFoundException } from '@nestjs/common';
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

  listar(
    condominioId: string,
    status: StatusChamado | undefined,
    tenantPrisma: TenantPrismaClient,
  ) {
    return tenantPrisma.chamado.findMany({
      where: { condominioId, ...(status ? { status } : {}) },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async atualizar(chamadoId: string, dto: AtualizarChamadoDto, tenantPrisma: TenantPrismaClient) {
    const chamadoAtual = await tenantPrisma.chamado.findUnique({ where: { id: chamadoId } });
    if (!chamadoAtual) {
      throw new NotFoundException('Chamado não encontrado.');
    }

    if (dto.responsavelId) {
      const responsavel = await tenantPrisma.usuario.findUnique({
        where: { id: dto.responsavelId },
      });
      if (!responsavel) {
        throw new NotFoundException('Usuário responsável não encontrado.');
      }
    }

    const chamadoAtualizado = await tenantPrisma.chamado.update({
      where: { id: chamadoId },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.categoria ? { categoria: dto.categoria } : {}),
        ...(dto.responsavelId !== undefined ? { responsavelId: dto.responsavelId } : {}),
      },
    });

    if (dto.status && dto.status !== chamadoAtual.status) {
      this.emitirMudancaDeStatus(
        chamadoId,
        chamadoAtual.condominioId,
        chamadoAtual.status,
        dto.status,
      );
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
}
