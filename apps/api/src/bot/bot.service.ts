import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  WHATSAPP_CLOUD_API_CLIENT,
  WhatsappCloudApiClient,
} from '../whatsapp/whatsapp-cloud-api-client.interface';
import { ehTextoSuspeito, reconhecerIntencao } from './intencoes/reconhecer-intencao';
import { MENU_BOT, RESPOSTA_NAO_ENTENDI, RESPOSTA_SEM_VINCULO } from './menu';
import { IdentidadeResolvida } from './identidade';
import { FluxoEstado, lerFluxo } from './fluxos/tipos';
import { FluxoReservaService } from './fluxos/fluxo-reserva.service';
import { FluxoChamadoService } from './fluxos/fluxo-chamado.service';

const LABEL_STATUS_CHAMADO: Record<string, string> = {
  PENDENTE_TRIAGEM: 'Pendente de triagem',
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em andamento',
  RESOLVIDO: 'Resolvido',
};

const LABEL_MOTIVO_ADVERTENCIA: Record<string, string> = {
  BARULHO: 'Barulho/Perturbação',
  DESCUMPRIMENTO_REGRAS: 'Descumprimento de regras',
  DANO_PATRIMONIO: 'Dano ao patrimônio',
  INADIMPLENCIA: 'Inadimplência',
  CONDUTA_INADEQUADA: 'Conduta inadequada',
  OUTRO: 'Outro',
};

function formatarData(data: Date): string {
  return [data.getUTCDate(), data.getUTCMonth() + 1, data.getUTCFullYear()]
    .map((parte, indice) => (indice === 2 ? String(parte) : String(parte).padStart(2, '0')))
    .join('/');
}

function formatarValor(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

function truncar(texto: string, max: number): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

@Injectable()
export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_CLOUD_API_CLIENT) private readonly cloudApiClient: WhatsappCloudApiClient,
    private readonly fluxoReserva: FluxoReservaService,
    private readonly fluxoChamado: FluxoChamadoService,
  ) {}

  /**
   * Ponto de entrada do webhook: resolve identidade, decide a resposta
   * (fluxo em andamento ou intenção nova) e grava a conversa — tudo a
   * partir do `telefoneWhatsapp`, nunca do conteúdo de `texto`.
   */
  async processarMensagemEntrante(telefoneWhatsapp: string, texto: string): Promise<void> {
    const identidade = await this.resolverIdentidade(telefoneWhatsapp);
    const conversa = await this.prisma.conversaBot.findFirst({
      where: { telefoneWhatsapp },
      orderBy: { criadoEm: 'desc' },
    });

    const fluxoAtivo = identidade ? lerFluxo(conversa?.fluxo) : null;

    // Nunca deixa uma exceção inesperada virar 500 no webhook (a Meta
    // reenviaria o mesmo payload em loop) — o usuário recebe uma resposta
    // neutra e o fluxo é encerrado. Loga só o erro, nunca o texto da
    // mensagem (regra de logging do CLAUDE.md).
    let resposta: string;
    let fluxo: FluxoEstado | null;
    try {
      ({ resposta, fluxo } = await this.gerarResposta(identidade, fluxoAtivo, texto));
    } catch (erro) {
      console.error('[bot] erro ao gerar resposta', erro instanceof Error ? erro.message : erro);
      resposta =
        'Tive um problema pra processar sua mensagem agora. 😕 Tente de novo em instantes ou digite *menu*.';
      fluxo = null;
    }

    await this.registrarConversa(conversa, telefoneWhatsapp, identidade, texto, resposta, fluxo);

    // Falha de ENTREGA não pode virar 500: a mensagem já foi processada e
    // gravada — um 500 faria a Meta reenviar o payload e reprocessar tudo
    // (ex: abrir o mesmo chamado duas vezes). Loga (sem o texto) e segue.
    try {
      await this.cloudApiClient.enviarMensagemTexto(telefoneWhatsapp, resposta);
    } catch (erro) {
      console.error(
        '[bot] falha ao enviar resposta via Cloud API',
        erro instanceof Error ? erro.message : erro,
      );
    }
  }

  /**
   * Único lugar que decide "de qual unidade" o bot fala — exclusivamente a
   * partir do telefone. Quando o usuário tem mais de um vínculo com
   * unidade (ex: dono de duas unidades), usa o primeiro encontrado; é uma
   * limitação conhecida (escopo assume um telefone → uma unidade), não uma
   * falha de isolamento — o vínculo usado é sempre um vínculo real do
   * próprio usuário do telefone.
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

    return {
      usuarioId: usuario.id,
      unidadeId: unidade.id,
      condominioId: unidade.condominioId,
      identificadorUnidade: unidade.identificador,
    };
  }

  private async gerarResposta(
    identidade: IdentidadeResolvida | null,
    fluxoAtivo: FluxoEstado | null,
    texto: string,
  ): Promise<{ resposta: string; fluxo: FluxoEstado | null }> {
    if (!identidade) {
      return { resposta: RESPOSTA_SEM_VINCULO, fluxo: null };
    }

    // Denylist SEMPRE primeiro, inclusive no meio de um fluxo — uma frase
    // de manipulação encerra o fluxo em vez de virar "descrição de chamado".
    if (ehTextoSuspeito(texto)) {
      return { resposta: RESPOSTA_NAO_ENTENDI, fluxo: null };
    }

    // Comandos globais valem mesmo dentro de um fluxo
    const textoCompacto = texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (textoCompacto === 'cancelar' || textoCompacto === 'cancela') {
      return fluxoAtivo
        ? { resposta: `Ok, operação cancelada. 👍\n\n${MENU_BOT}`, fluxo: null }
        : { resposta: `Não há nenhuma operação em andamento.\n\n${MENU_BOT}`, fluxo: null };
    }
    if (textoCompacto === 'menu') {
      return { resposta: MENU_BOT, fluxo: null };
    }

    // Fluxo multi-turno em andamento: a mensagem é a resposta do passo atual
    if (fluxoAtivo?.tipo === 'RESERVA') {
      return this.fluxoReserva.processarResposta(identidade, fluxoAtivo, texto);
    }
    if (fluxoAtivo?.tipo === 'CHAMADO') {
      return this.fluxoChamado.processarResposta(identidade, texto);
    }

    const intencao = reconhecerIntencao(texto);
    switch (intencao.tipo) {
      case 'MENU':
        return { resposta: MENU_BOT, fluxo: null };
      case 'OPCAO_MENU':
        return this.executarOpcaoMenu(identidade, intencao.numero);
      case 'CANCELAR':
        return { resposta: `Não há nenhuma operação em andamento.\n\n${MENU_BOT}`, fluxo: null };
      case 'FINANCEIRO':
        return { resposta: await this.responderFinanceiro(identidade), fluxo: null };
      case 'ASSEMBLEIAS':
        return { resposta: await this.responderAssembleias(identidade), fluxo: null };
      case 'RESERVAR':
        return this.fluxoReserva.iniciar(identidade, intencao.areaComum);
      case 'ABRIR_CHAMADO':
        return this.fluxoChamado.iniciar();
      case 'MEUS_CHAMADOS':
        return { resposta: await this.responderMeusChamados(identidade), fluxo: null };
      case 'ADVERTENCIA':
        return { resposta: await this.responderAdvertencia(identidade), fluxo: null };
      case 'ACOES_ADMINISTRATIVAS':
        return { resposta: await this.responderAcoesAdministrativas(identidade), fluxo: null };
      case 'AVISOS':
        return { resposta: await this.responderAvisos(identidade), fluxo: null };
      case 'BOLETO':
        return { resposta: await this.responderBoleto(identidade), fluxo: null };
      case 'DESCONHECIDA':
        return { resposta: RESPOSTA_NAO_ENTENDI, fluxo: null };
    }
  }

  /** Contrato com a numeração do MENU_BOT (bot/menu.ts). */
  private async executarOpcaoMenu(
    identidade: IdentidadeResolvida,
    numero: number,
  ): Promise<{ resposta: string; fluxo: FluxoEstado | null }> {
    switch (numero) {
      case 1:
        return { resposta: await this.responderFinanceiro(identidade), fluxo: null };
      case 2:
        return { resposta: await this.responderAssembleias(identidade), fluxo: null };
      case 3:
        return this.fluxoReserva.iniciar(identidade, null);
      case 4:
        return this.fluxoChamado.iniciar();
      case 5:
        return { resposta: await this.responderMeusChamados(identidade), fluxo: null };
      case 6:
        return { resposta: await this.responderAdvertencia(identidade), fluxo: null };
      case 7:
        return { resposta: await this.responderAcoesAdministrativas(identidade), fluxo: null };
      case 8:
        return { resposta: await this.responderAvisos(identidade), fluxo: null };
      case 9:
        return { resposta: await this.responderBoleto(identidade), fluxo: null };
      default:
        return { resposta: RESPOSTA_NAO_ENTENDI, fluxo: null };
    }
  }

  // ── Consultas (sempre pinadas à unidade/condomínio da identidade) ─────────

  /**
   * Visão financeira DA UNIDADE do condômino — nunca do condomínio inteiro
   * (totais do condomínio são restritos a SINDICO/ADMINISTRADORA, regra de
   * domínio do CLAUDE.md; a versão pra esses papéis virá depois).
   */
  private async responderFinanceiro(identidade: IdentidadeResolvida): Promise<string> {
    const inicioDoAno = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));

    const [emAberto, emAtraso, pagasNoAno] = await Promise.all([
      this.prisma.cobranca.aggregate({
        where: { unidadeId: identidade.unidadeId, status: { in: ['PENDENTE', 'ATRASADO'] } },
        _sum: { valor: true },
        _count: true,
        _min: { vencimento: true },
      }),
      this.prisma.cobranca.aggregate({
        where: { unidadeId: identidade.unidadeId, status: 'ATRASADO' },
        _sum: { valor: true },
        _count: true,
      }),
      this.prisma.cobranca.aggregate({
        where: { unidadeId: identidade.unidadeId, status: 'PAGO', pagoEm: { gte: inicioDoAno } },
        _sum: { valor: true },
        _count: true,
      }),
    ]);

    const somar = (valor: Prisma.Decimal | null) => Number(valor ?? 0);
    const totalAberto = somar(emAberto._sum.valor);
    const totalAtraso = somar(emAtraso._sum.valor);
    const totalPago = somar(pagasNoAno._sum.valor);

    const linhas = [
      `💰 *Financeiro da unidade ${identidade.identificadorUnidade}*`,
      `• A pagar (em aberto): ${formatarValor(totalAberto)} (${emAberto._count} cobrança${emAberto._count === 1 ? '' : 's'})`,
      `• Em atraso: ${formatarValor(totalAtraso)}${emAtraso._count ? ` (${emAtraso._count})` : ''}`,
      `• Pago em ${new Date().getUTCFullYear()}: ${formatarValor(totalPago)} (${pagasNoAno._count} cobrança${pagasNoAno._count === 1 ? '' : 's'})`,
      `• Saldo devedor: ${formatarValor(totalAberto)}`,
    ];
    if (emAberto._min.vencimento) {
      linhas.push(`• Próximo vencimento: ${formatarData(emAberto._min.vencimento)}`);
    }
    if (totalAberto === 0) {
      linhas.push('Você está em dia. ✅');
    }
    return linhas.join('\n');
  }

  private async responderAssembleias(identidade: IdentidadeResolvida): Promise<string> {
    const [realizadas, proximaAgendada] = await Promise.all([
      this.prisma.assembleia.findMany({
        where: { condominioId: identidade.condominioId, status: 'REALIZADA' },
        include: { pautas: { orderBy: { ordem: 'asc' } } },
        orderBy: { dataHora: 'desc' },
        take: 2,
      }),
      this.prisma.assembleia.findFirst({
        where: {
          condominioId: identidade.condominioId,
          status: 'AGENDADA',
          dataHora: { gte: new Date() },
        },
        orderBy: { dataHora: 'asc' },
      }),
    ]);

    const blocos: string[] = ['🏛 *Resultados de assembleias*'];

    if (realizadas.length === 0) {
      blocos.push('Ainda não há assembleias realizadas com resultados registrados.');
    }
    for (const assembleia of realizadas) {
      const pautas = assembleia.pautas
        .map(
          (p, i) =>
            `  ${i + 1}. ${p.titulo}${p.deliberacao ? ` — ${truncar(p.deliberacao, 140)}` : ''}`,
        )
        .join('\n');
      blocos.push(
        `📌 *${assembleia.titulo}* (${formatarData(assembleia.dataHora)})\n${pautas}` +
          (assembleia.linkGravacao ? `\n  🎥 Gravação: ${assembleia.linkGravacao}` : ''),
      );
    }

    if (proximaAgendada) {
      blocos.push(
        `🗓 Próxima assembleia: *${proximaAgendada.titulo}* em ${formatarData(proximaAgendada.dataHora)}${proximaAgendada.local ? ` (${proximaAgendada.local})` : ''}.`,
      );
    }

    return blocos.join('\n\n');
  }

  /** Chamados abertos pelo próprio usuário OU da própria unidade — mesma
   *  regra de visibilidade de CONDOMINO da API (ChamadosService.listar). */
  private async responderMeusChamados(identidade: IdentidadeResolvida): Promise<string> {
    const chamados = await this.prisma.chamado.findMany({
      where: {
        condominioId: identidade.condominioId,
        OR: [{ abertoPorId: identidade.usuarioId }, { unidadeId: identidade.unidadeId }],
      },
      orderBy: { criadoEm: 'desc' },
      take: 5,
    });

    if (chamados.length === 0) {
      return 'Você ainda não tem nenhum chamado. Pra abrir um, responda *4* ou *abrir chamado*.';
    }

    const linhas = chamados.map(
      (c) =>
        `• [${LABEL_STATUS_CHAMADO[c.status] ?? c.status}] ${truncar(c.titulo, 60)} (${formatarData(c.criadoEm)})`,
    );
    return `🛠 *Seus chamados mais recentes*\n${linhas.join('\n')}\n\nPra abrir um novo, responda *4*.`;
  }

  private async responderAdvertencia(identidade: IdentidadeResolvida): Promise<string> {
    const advertencia = await this.prisma.advertencia.findFirst({
      where: { unidadeId: identidade.unidadeId },
      orderBy: { criadoEm: 'desc' },
    });

    if (!advertencia) {
      return 'Sua unidade não tem nenhuma advertência registrada. ✅';
    }

    return (
      `⚠️ *Última advertência da unidade ${identidade.identificadorUnidade}*\n` +
      `Motivo: ${LABEL_MOTIVO_ADVERTENCIA[advertencia.motivo] ?? advertencia.motivo}\n` +
      `Data: ${formatarData(advertencia.criadoEm)}\n` +
      `${truncar(advertencia.descricao, 300)}`
    );
  }

  private async responderAcoesAdministrativas(identidade: IdentidadeResolvida): Promise<string> {
    const acoes = await this.prisma.acaoAdministrativa.findMany({
      where: { condominioId: identidade.condominioId },
      orderBy: { realizadaEm: 'desc' },
      take: 3,
    });

    if (acoes.length === 0) {
      return 'Nenhuma ação administrativa registrada no seu condomínio ainda.';
    }

    const linhas = acoes.map((a) => {
      const validade = a.validoAte ? ` — válido até ${formatarData(a.validoAte)}` : '';
      return `• *${a.titulo}* (${formatarData(a.realizadaEm)})${validade}${a.descricao ? `\n  ${truncar(a.descricao, 120)}` : ''}`;
    });
    return `📋 *Últimas ações administrativas*\n${linhas.join('\n')}`;
  }

  /** Avisos do condomínio inteiro ou direcionados à unidade do usuário —
   *  nunca avisos direcionados a OUTRA unidade. */
  private async responderAvisos(identidade: IdentidadeResolvida): Promise<string> {
    const avisos = await this.prisma.aviso.findMany({
      where: {
        condominioId: identidade.condominioId,
        enviadoEm: { not: null },
        OR: [{ unidadeId: null }, { unidadeId: identidade.unidadeId }],
      },
      orderBy: { enviadoEm: 'desc' },
      take: 3,
    });

    if (avisos.length === 0) {
      return 'Nenhum aviso publicado no seu condomínio ainda.';
    }

    const blocos = avisos.map(
      (a) => `📢 *${a.titulo}* (${formatarData(a.enviadoEm!)})\n${truncar(a.corpo, 200)}`,
    );
    return `*Últimos avisos*\n\n${blocos.join('\n\n')}`;
  }

  /**
   * 2ª via de boleto: a emissão ainda não foi implementada no produto — a
   * opção existe no menu, e quando a cobrança tiver um linkPagamento real
   * (capturado do Asaas na criação), ele é enviado; caso contrário, o bot
   * explica que está a caminho.
   */
  private async responderBoleto(identidade: IdentidadeResolvida): Promise<string> {
    const cobranca = await this.prisma.cobranca.findFirst({
      where: { unidadeId: identidade.unidadeId, status: { in: ['PENDENTE', 'ATRASADO'] } },
      orderBy: { vencimento: 'desc' },
    });

    if (!cobranca) {
      return 'Você não tem nenhuma cobrança em aberto — não há 2ª via pra emitir. ✅';
    }

    const linha = `Sua cobrança em aberto: ${formatarValor(Number(cobranca.valor))}, vencimento ${formatarData(cobranca.vencimento)}.`;
    if (cobranca.linkPagamento) {
      return `${linha}\n2ª via: ${cobranca.linkPagamento}`;
    }
    return (
      `${linha}\n🚧 A emissão de 2ª via de boleto por aqui está em implantação — ` +
      'em breve você vai receber o link direto nesta conversa. Por enquanto, consulte o app do Condly.'
    );
  }

  /**
   * Mantém uma conversa por telefone (a mais recente já existente é
   * reaproveitada, nunca criada uma nova a cada mensagem) e persiste o
   * estado do fluxo multi-turno. Se a conversa começou antes do número
   * estar cadastrado (`unidadeId` ainda null) e a identidade resolveu
   * agora, religa `unidadeId` — nunca o contrário.
   */
  private async registrarConversa(
    conversaExistente: { id: string; unidadeId: string | null; mensagens: unknown } | null,
    telefoneWhatsapp: string,
    identidade: IdentidadeResolvida | null,
    textoRecebido: string,
    textoRespondido: string,
    fluxo: FluxoEstado | null,
  ): Promise<void> {
    const agora = new Date().toISOString();
    const novasMensagens = [
      { remetente: 'USUARIO', texto: textoRecebido, enviadoEm: agora },
      { remetente: 'BOT', texto: textoRespondido, enviadoEm: agora },
    ];

    const fluxoJson =
      fluxo === null ? Prisma.JsonNull : (fluxo as unknown as Prisma.InputJsonValue);

    if (!conversaExistente) {
      await this.prisma.conversaBot.create({
        data: {
          telefoneWhatsapp,
          unidadeId: identidade?.unidadeId ?? null,
          mensagens: novasMensagens,
          fluxo: fluxoJson,
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
        mensagens: [...mensagensExistentes, ...novasMensagens] as Prisma.InputJsonValue,
        fluxo: fluxoJson,
      },
    });
  }
}
