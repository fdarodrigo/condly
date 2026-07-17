import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdentidadeResolvida } from '../identidade';
import { FluxoChamadoEstado } from './tipos';

export interface PassoFluxoChamado {
  resposta: string;
  fluxo: FluxoChamadoEstado | null;
}

/**
 * Fluxo de abertura de chamado pelo bot: pergunta a descrição do problema e
 * cria o Chamado como PENDENTE_TRIAGEM (mesmo status de quando um CONDOMINO
 * abre pelo app — o síndico tria depois). `abertoPorId`/`unidadeId`/
 * `condominioId` vêm exclusivamente da identidade resolvida pelo telefone.
 */
@Injectable()
export class FluxoChamadoService {
  constructor(private readonly prisma: PrismaService) {}

  iniciar(): PassoFluxoChamado {
    return {
      resposta:
        'Vamos abrir um chamado. 🛠\nDescreva o problema em uma mensagem ' +
        '(ex: "Vazamento no teto da garagem, próximo à vaga 12").',
      fluxo: { tipo: 'CHAMADO', etapa: 'DESCRICAO', atualizadoEm: new Date().toISOString() },
    };
  }

  async processarResposta(
    identidade: IdentidadeResolvida,
    texto: string,
  ): Promise<PassoFluxoChamado> {
    const descricao = texto.trim();
    if (descricao.length < 5) {
      return {
        resposta:
          'Preciso de uma descrição um pouco mais detalhada pra registrar o chamado. ' +
          'Tente novamente (ou responda *cancelar*).',
        fluxo: { tipo: 'CHAMADO', etapa: 'DESCRICAO', atualizadoEm: new Date().toISOString() },
      };
    }

    // O texto do usuário vira título/descrição do chamado — dado inerte
    // (nunca interpretado como comando). Categoria fixa OUTRO: o bot não
    // tenta classificar; a triagem do síndico ajusta depois, se quiser.
    const titulo = descricao.length > 80 ? `${descricao.slice(0, 77)}...` : descricao;
    const chamado = await this.prisma.chamado.create({
      data: {
        condominioId: identidade.condominioId,
        unidadeId: identidade.unidadeId,
        abertoPorId: identidade.usuarioId,
        titulo,
        descricao,
        categoria: 'OUTRO',
        status: 'PENDENTE_TRIAGEM',
      },
    });

    return {
      resposta:
        `Chamado registrado! ✅\n*${chamado.titulo}*\n` +
        'Status: *Pendente de triagem* — o síndico vai analisar e classificar. ' +
        'Acompanhe respondendo *meus chamados* ou pelo app.',
      fluxo: null,
    };
  }
}
