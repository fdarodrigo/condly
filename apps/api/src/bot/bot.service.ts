import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  WHATSAPP_CLOUD_API_CLIENT,
  WhatsappCloudApiClient,
} from '../whatsapp/whatsapp-cloud-api-client.interface';
import { reconhecerIntencao } from './intencoes/reconhecer-intencao';

const RESPOSTA_PADRAO =
  'Não entendi sua mensagem. Posso te ajudar com:\n' +
  "- 'saldo' — consultar sua cobrança em aberto e a 2ª via\n" +
  "- 'reservar' + nome da área comum — iniciar uma reserva\n" +
  "- 'chamado' — abrir um chamado\n" +
  'Para outras solicitações, acesse o app do Condly.';

const RESPOSTA_SEM_VINCULO =
  'Não encontrei seu cadastro vinculado a este número de WhatsApp. ' +
  'Acesse o app do Condly e cadastre este número no seu perfil para eu poder te ajudar.';

function formatarData(data: Date): string {
  return [data.getUTCDate(), data.getUTCMonth() + 1, data.getUTCFullYear()]
    .map((parte, indice) => (indice === 2 ? String(parte) : String(parte).padStart(2, '0')))
    .join('/');
}

function formatarValor(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

/**
 * Identidade resolvida pro telefone de origem da mensagem — NUNCA derivada
 * do texto da mensagem em si. Quando o telefone não está cadastrado em
 * nenhum Usuario, ou o Usuario não tem nenhum vínculo com unidade, o
 * resultado é `null` e o bot orienta o cadastro pelo app.
 */
interface IdentidadeResolvida {
  unidadeId: string;
  condominioId: string;
}

@Injectable()
export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_CLOUD_API_CLIENT) private readonly cloudApiClient: WhatsappCloudApiClient,
  ) {}

  /**
   * Ponto de entrada do webhook: resolve identidade, decide a resposta e
   * grava a conversa — tudo a partir do `telefoneWhatsapp`, nunca do
   * conteúdo de `texto`.
   */
  async processarMensagemEntrante(telefoneWhatsapp: string, texto: string): Promise<void> {
    const identidade = await this.resolverIdentidade(telefoneWhatsapp);
    const resposta = await this.gerarResposta(identidade, texto);

    await this.registrarConversa(telefoneWhatsapp, identidade, texto, resposta);
    await this.cloudApiClient.enviarMensagemTexto(telefoneWhatsapp, resposta);
  }

  /**
   * Único lugar que decide "de qual unidade" o bot fala — exclusivamente a
   * partir do telefone. Quando o usuário tem mais de um vínculo com
   * unidade (ex: dono de duas unidades), usa o primeiro encontrado; é uma
   * limitação conhecida (escopo deste prompt assume um telefone → uma
   * unidade), não uma falha de isolamento — o vínculo usado é sempre um
   * vínculo real do próprio usuário do telefone.
   */
  private async resolverIdentidade(telefoneWhatsapp: string): Promise<IdentidadeResolvida | null> {
    const usuario = await this.prisma.usuario.findFirst({ where: { telefoneWhatsapp } });
    if (!usuario) {
      return null;
    }

    const vinculo = await this.prisma.vinculoUsuario.findFirst({
      where: { usuarioId: usuario.id, unidadeId: { not: null } },
    });
    if (!vinculo?.unidadeId) {
      return null;
    }

    const unidade = await this.prisma.unidade.findUnique({ where: { id: vinculo.unidadeId } });
    if (!unidade) {
      return null;
    }

    return { unidadeId: unidade.id, condominioId: unidade.condominioId };
  }

  private async gerarResposta(
    identidade: IdentidadeResolvida | null,
    texto: string,
  ): Promise<string> {
    if (!identidade) {
      return RESPOSTA_SEM_VINCULO;
    }

    const intencao = reconhecerIntencao(texto);
    switch (intencao.tipo) {
      case 'SALDO':
        return this.responderSaldo(identidade.unidadeId);
      case 'RESERVAR':
        return this.responderReservar(identidade.condominioId, intencao.areaComum);
      case 'CHAMADO':
        return this.responderChamado();
      case 'DESCONHECIDA':
        return RESPOSTA_PADRAO;
    }
  }

  private async responderSaldo(unidadeId: string): Promise<string> {
    const cobranca = await this.prisma.cobranca.findFirst({
      where: { unidadeId, status: { in: ['PENDENTE', 'ATRASADO'] } },
      orderBy: { vencimento: 'desc' },
    });

    if (!cobranca) {
      return 'Você não tem nenhuma cobrança pendente no momento.';
    }

    const linha = `Sua cobrança mais recente em aberto é de ${formatarValor(Number(cobranca.valor))}, com vencimento em ${formatarData(cobranca.vencimento)}.`;
    if (!cobranca.linkPagamento) {
      return `${linha}\nA 2ª via não está disponível por aqui ainda — consulte o app.`;
    }
    return `${linha}\n2ª via: ${cobranca.linkPagamento}`;
  }

  private async responderReservar(condominioId: string, areaComum: string | null): Promise<string> {
    if (!areaComum) {
      return "Pra reservar, me diga o nome da área comum (ex: 'reservar salão de festas').";
    }

    const area = await this.prisma.areaComum.findFirst({
      where: { condominioId, nome: { contains: areaComum, mode: 'insensitive' } },
    });

    if (!area) {
      const areas = await this.prisma.areaComum.findMany({ where: { condominioId } });
      const nomes = areas.map((a) => a.nome).join(', ');
      return areas.length
        ? `Não encontrei a área comum "${areaComum}". Áreas disponíveis: ${nomes}.`
        : `Não encontrei a área comum "${areaComum}".`;
    }

    return `Vamos iniciar sua reserva de ${area.nome}. Acesse o app do Condly pra escolher data e horário e confirmar.`;
  }

  private responderChamado(): string {
    return (
      'Vamos abrir um chamado. Descreva o problema com detalhes pelo app do Condly ' +
      '(seção Chamados) pra registrar e acompanhar o atendimento.'
    );
  }

  /**
   * Mantém uma conversa por telefone (a mais recente já existente é
   * reaproveitada, nunca criada uma nova a cada mensagem). Se a conversa
   * começou antes do número estar cadastrado (`unidadeId` ainda null) e a
   * identidade resolveu agora, religa `unidadeId` — nunca o contrário (uma
   * conversa já vinculada nunca volta a ficar sem unidade).
   */
  private async registrarConversa(
    telefoneWhatsapp: string,
    identidade: IdentidadeResolvida | null,
    textoRecebido: string,
    textoRespondido: string,
  ): Promise<void> {
    const agora = new Date().toISOString();
    const novasMensagens = [
      { remetente: 'USUARIO', texto: textoRecebido, enviadoEm: agora },
      { remetente: 'BOT', texto: textoRespondido, enviadoEm: agora },
    ];

    const conversaExistente = await this.prisma.conversaBot.findFirst({
      where: { telefoneWhatsapp },
      orderBy: { criadoEm: 'desc' },
    });

    if (!conversaExistente) {
      await this.prisma.conversaBot.create({
        data: {
          telefoneWhatsapp,
          unidadeId: identidade?.unidadeId ?? null,
          mensagens: novasMensagens,
        },
      });
      return;
    }

    const mensagensExistentes = Array.isArray(conversaExistente.mensagens)
      ? conversaExistente.mensagens
      : [];

    await this.prisma.conversaBot.update({
      where: { id: conversaExistente.id },
      data: {
        unidadeId: conversaExistente.unidadeId ?? identidade?.unidadeId ?? null,
        mensagens: [...mensagensExistentes, ...novasMensagens],
      },
    });
  }
}
