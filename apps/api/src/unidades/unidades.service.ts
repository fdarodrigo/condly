import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UnidadesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rota "minha conta" (sem condominioId/unidadeId no path) — o filtro de
   * tenant aqui é a própria igualdade `usuarioId = usuário logado`, mesmo
   * padrão já usado em `AvisosService.listarNaoLidos`. A unidade nunca vem
   * de um parâmetro informado pelo cliente: é resolvida só a partir do
   * vínculo do usuário autenticado, igual a `BotService.resolverIdentidade`
   * (mesma regra de identidade, só que a "identidade" aqui já vem do JWT em
   * vez do telefoneWhatsapp).
   */
  async meuSaldo(usuarioId: string) {
    const vinculo = await this.prisma.vinculoUsuario.findFirst({
      where: { usuarioId, unidadeId: { not: null } },
    });
    if (!vinculo?.unidadeId) {
      throw new NotFoundException('Usuário não está vinculado a nenhuma unidade.');
    }

    const cobrancaPendente = await this.prisma.cobranca.findFirst({
      where: { unidadeId: vinculo.unidadeId, status: { in: ['PENDENTE', 'ATRASADO'] } },
      orderBy: { vencimento: 'desc' },
    });

    return { unidadeId: vinculo.unidadeId, cobrancaPendente };
  }
}
