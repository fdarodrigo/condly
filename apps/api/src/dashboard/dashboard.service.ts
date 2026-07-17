import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaClient } from '../prisma/tenant-prisma';

const CHAMADO_STATUS_ABERTOS = ['PENDENTE_TRIAGEM', 'ABERTO', 'EM_ANDAMENTO'] as const;
const TOP_N_CONDOMINIOS_MAIS_CHAMADOS = 5;
const PROXIMOS_N_SERVICOS = 5;
const RESERVAS_PROXIMOS_DIAS = 7;
const SERVICOS_A_VENCER_DIAS = 30;

const NOMES_FLAGS_UNIDADE: Record<string, string> = {
  bebeRecemNascido: 'Bebê recém-nascido',
  trabalhadorNoturno: 'Trabalhador noturno',
  pessoasIdosas: 'Pessoas idosas',
  pets: 'Pets',
  pessoasAutismo: 'Autismo/TEA',
  estrangeiros: 'Estrangeiros',
  mobilidadeReduzida: 'Mobilidade reduzida',
  locacaoCurtaTemporada: 'Aluguel temporada',
};

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function limitesDoMes(agora: Date) {
  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const inicioProximoMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));
  // Comparação de atraso é por data-calendário, não por timestamp — mesma
  // regra de FinanceiroService.obterResumo (uma cobrança que vence HOJE
  // ainda não está atrasada, só a partir de amanhã).
  const inicioDeHoje = new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
  );
  return { inicioMes, inicioProximoMes, inicioDeHoje };
}

interface LinhaRankingFinanceiro {
  condominioId: string;
  nome: string;
  totalRecebidoNoMes: number;
  totalAReceberNoMes: number;
  totalEmAtraso: number;
  totalAtraso1a30d: number;
  totalAtraso31a60d: number;
  totalAtraso61a90d: number;
  totalAtraso90dMais: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async condominio(condominioId: string, tenantPrisma: TenantPrismaClient) {
    const agora = new Date();
    const { inicioMes, inicioProximoMes, inicioDeHoje } = limitesDoMes(agora);
    const em7Dias = new Date(agora.getTime() + RESERVAS_PROXIMOS_DIAS * 86_400_000);

    const unidades = await tenantPrisma.unidade.findMany({ where: { condominioId } });
    const unidadeIds = unidades.map((unidade) => unidade.id);

    const cobrancas = await tenantPrisma.cobranca.findMany({
      where: { unidadeId: { in: unidadeIds } },
    });

    let totalArrecadadoNoMes = 0;
    let totalEmAtraso = 0;
    for (const cobranca of cobrancas) {
      const valor = Number(cobranca.valor);
      const pagoNesteMes =
        cobranca.pagoEm && cobranca.pagoEm >= inicioMes && cobranca.pagoEm < inicioProximoMes;
      if (cobranca.status === 'PAGO' && pagoNesteMes) {
        totalArrecadadoNoMes += valor;
      }
      const inadimplente =
        cobranca.status === 'ATRASADO' ||
        (cobranca.status === 'PENDENTE' && cobranca.vencimento < inicioDeHoje);
      if (inadimplente) {
        totalEmAtraso += valor;
      }
    }

    const contagensPorStatus = await Promise.all(
      CHAMADO_STATUS_ABERTOS.map((status) =>
        tenantPrisma.chamado.count({ where: { condominioId, status } }),
      ),
    );
    const chamadosPorStatus = Object.fromEntries(
      CHAMADO_STATUS_ABERTOS.map((status, indice) => [status, contagensPorStatus[indice]]),
    );

    const proximosVencimentosServicos = await tenantPrisma.servicoPeriodico.findMany({
      where: { condominioId, proximoVencimento: { gte: inicioDeHoje } },
      orderBy: { proximoVencimento: 'asc' },
      take: PROXIMOS_N_SERVICOS,
    });

    const reservasProximos7Dias = await tenantPrisma.reserva.findMany({
      where: { status: 'CONFIRMADA', inicio: { gte: agora, lt: em7Dias } },
      include: {
        areaComum: { select: { nome: true } },
        unidade: { select: { identificador: true } },
      },
      orderBy: { inicio: 'asc' },
    });

    return {
      totalArrecadadoNoMes: arredondar(totalArrecadadoNoMes),
      totalEmAtraso: arredondar(totalEmAtraso),
      chamadosPorStatus,
      proximosVencimentosServicos,
      reservasProximos7Dias,
    };
  }

  /**
   * Visão agregada da carteira. Otimizada pra não escalar com o número de
   * condomínios da administradora: 2 queries no total, sempre, independente
   * de ter 1 ou 1000 condomínios — uma para os totais financeiros (raw SQL
   * com agregação condicional no banco, já que Cobranca não tem
   * condominioId direto pra um `groupBy` simples do Prisma alcançar) e uma
   * para a contagem de chamados (`groupBy` do Prisma por condominioId).
   * Ver dashboard.integration-spec.ts para a asserção de contagem de
   * queries que prova isso. `tenantPrisma` (não `this.prisma`) no
   * `groupBy` de Chamado é a 2ª camada de defesa via `tenant-prisma.ts`;
   * a raw query continua em `this.prisma` porque `$queryRaw` não passa
   * pela extensão de tenant de qualquer forma — o filtro manual no WHERE
   * é a única proteção ali, ver CLAUDE.md.
   */
  async administradora(administradoraId: string, tenantPrisma: TenantPrismaClient) {
    const agora = new Date();
    const { inicioMes, inicioProximoMes, inicioDeHoje } = limitesDoMes(agora);

    // Datas de corte para as faixas de inadimplência
    const ha30Dias = new Date(inicioDeHoje.getTime() - 30 * 86_400_000);
    const ha60Dias = new Date(inicioDeHoje.getTime() - 60 * 86_400_000);
    const ha90Dias = new Date(inicioDeHoje.getTime() - 90 * 86_400_000);
    const em30Dias = new Date(inicioDeHoje.getTime() + SERVICOS_A_VENCER_DIAS * 86_400_000);

    // Query 1: totais financeiros + faixas de inadimplência por condomínio.
    // As faixas de aging são colunas adicionais no mesmo SELECT, sem query extra.
    // ATENÇÃO: $queryRaw não passa pelo filtro de tenant-prisma.ts — o
    // WHERE manual é a única proteção aqui, ver CLAUDE.md.
    const rankingFinanceiro = await this.prisma.$queryRaw<LinhaRankingFinanceiro[]>`
      SELECT
        cond.id AS "condominioId",
        cond.nome AS "nome",
        COALESCE(SUM(CASE
          WHEN cb."status" = 'PAGO' AND cb."pagoEm" >= ${inicioMes} AND cb."pagoEm" < ${inicioProximoMes}
          THEN cb."valor" ELSE 0
        END), 0) AS "totalRecebidoNoMes",
        COALESCE(SUM(CASE
          WHEN cb."vencimento" >= ${inicioMes} AND cb."vencimento" < ${inicioProximoMes}
          THEN cb."valor" ELSE 0
        END), 0) AS "totalAReceberNoMes",
        COALESCE(SUM(CASE
          WHEN cb."status" = 'ATRASADO' OR (cb."status" = 'PENDENTE' AND cb."vencimento" < ${inicioDeHoje})
          THEN cb."valor" ELSE 0
        END), 0) AS "totalEmAtraso",
        COALESCE(SUM(CASE
          WHEN (cb."status" = 'ATRASADO' OR (cb."status" = 'PENDENTE' AND cb."vencimento" < ${inicioDeHoje}))
            AND cb."vencimento" >= ${ha30Dias}
          THEN cb."valor" ELSE 0
        END), 0) AS "totalAtraso1a30d",
        COALESCE(SUM(CASE
          WHEN (cb."status" = 'ATRASADO' OR (cb."status" = 'PENDENTE' AND cb."vencimento" < ${inicioDeHoje}))
            AND cb."vencimento" >= ${ha60Dias} AND cb."vencimento" < ${ha30Dias}
          THEN cb."valor" ELSE 0
        END), 0) AS "totalAtraso31a60d",
        COALESCE(SUM(CASE
          WHEN (cb."status" = 'ATRASADO' OR (cb."status" = 'PENDENTE' AND cb."vencimento" < ${inicioDeHoje}))
            AND cb."vencimento" >= ${ha90Dias} AND cb."vencimento" < ${ha60Dias}
          THEN cb."valor" ELSE 0
        END), 0) AS "totalAtraso61a90d",
        COALESCE(SUM(CASE
          WHEN (cb."status" = 'ATRASADO' OR (cb."status" = 'PENDENTE' AND cb."vencimento" < ${inicioDeHoje}))
            AND cb."vencimento" < ${ha90Dias}
          THEN cb."valor" ELSE 0
        END), 0) AS "totalAtraso90dMais"
      FROM "Condominio" cond
      LEFT JOIN "Unidade" u ON u."condominioId" = cond.id
      LEFT JOIN "Cobranca" cb ON cb."unidadeId" = u.id
      WHERE cond."administradoraId" = ${administradoraId}
      GROUP BY cond.id, cond.nome
    `;

    const condominioIds = rankingFinanceiro.map((linha) => linha.condominioId);
    const nomePorCondominioId = new Map(rankingFinanceiro.map((l) => [l.condominioId, l.nome]));

    // Query 2: chamados abertos por condomínio (groupBy, via tenantPrisma — 2ª camada)
    const chamadosPorCondominio = await tenantPrisma.chamado.groupBy({
      by: ['condominioId'],
      where: { condominioId: { in: condominioIds }, status: { not: 'RESOLVIDO' } },
      _count: { _all: true },
    });
    const chamadosPendentesPorCondominioId = new Map(
      chamadosPorCondominio.map((linha) => [linha.condominioId, linha._count._all]),
    );

    // Query 3: serviços periódicos a vencer nos próximos 30 dias (tenantPrisma
    // filtra automaticamente por condominio.administradoraId via tenant-prisma.ts)
    const servicosAVencer = await tenantPrisma.servicoPeriodico.findMany({
      where: { proximoVencimento: { gte: inicioDeHoje, lte: em30Dias } },
      include: { condominio: { select: { id: true, nome: true } } },
      orderBy: { proximoVencimento: 'asc' },
    });

    const rankingArrecadacao = rankingFinanceiro
      .map((linha) => ({
        condominioId: linha.condominioId,
        nome: linha.nome,
        totalRecebidoNoMes: arredondar(Number(linha.totalRecebidoNoMes)),
        totalAReceberNoMes: arredondar(Number(linha.totalAReceberNoMes)),
        // null (não 0) quando não há nada a receber no mês — "100% de uma
        // cobrança que não existe" e "0% de inadimplência" são afirmações
        // diferentes, nenhuma das duas é verdade quando não há dado.
        taxaArrecadacao:
          Number(linha.totalAReceberNoMes) > 0
            ? arredondar(Number(linha.totalRecebidoNoMes) / Number(linha.totalAReceberNoMes))
            : null,
      }))
      .sort((a, b) => (b.taxaArrecadacao ?? -1) - (a.taxaArrecadacao ?? -1));

    const rankingInadimplencia = rankingFinanceiro
      .map((linha) => ({
        condominioId: linha.condominioId,
        nome: linha.nome,
        totalEmAtraso: arredondar(Number(linha.totalEmAtraso)),
      }))
      .sort((a, b) => b.totalEmAtraso - a.totalEmAtraso);

    const condominiosComMaisChamadosPendentes = condominioIds
      .map((condominioId) => ({
        condominioId,
        nome: nomePorCondominioId.get(condominioId)!,
        chamadosPendentes: chamadosPendentesPorCondominioId.get(condominioId) ?? 0,
      }))
      .sort((a, b) => b.chamadosPendentes - a.chamadosPendentes)
      .slice(0, TOP_N_CONDOMINIOS_MAIS_CHAMADOS);

    const totalChamadosAbertos = Array.from(chamadosPendentesPorCondominioId.values()).reduce(
      (soma, contagem) => soma + contagem,
      0,
    );

    // Totais por faixa de inadimplência agregados em toda a carteira
    const inadimplenciaPorFaixa = {
      de1a30d: arredondar(rankingFinanceiro.reduce((s, l) => s + Number(l.totalAtraso1a30d), 0)),
      de31a60d: arredondar(rankingFinanceiro.reduce((s, l) => s + Number(l.totalAtraso31a60d), 0)),
      de61a90d: arredondar(rankingFinanceiro.reduce((s, l) => s + Number(l.totalAtraso61a90d), 0)),
      de90dMais: arredondar(
        rankingFinanceiro.reduce((s, l) => s + Number(l.totalAtraso90dMais), 0),
      ),
    };

    return {
      totalChamadosAbertos,
      rankingArrecadacao,
      rankingInadimplencia,
      condominiosComMaisChamadosPendentes,
      inadimplenciaPorFaixa,
      servicosAVencer,
    };
  }

  async metricasUnidades(condominioId: string, tenantPrisma: TenantPrismaClient) {
    const agora = new Date();
    const inicioDeHoje = new Date(
      Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
    );

    const unidades = await tenantPrisma.unidade.findMany({
      where: { condominioId },
      include: { dadosUnidade: true },
      orderBy: { identificador: 'asc' },
    });
    const unidadeIds = unidades.map((u) => u.id);

    const cobrancas = await tenantPrisma.cobranca.findMany({
      where: { unidadeId: { in: unidadeIds } },
      select: { unidadeId: true, status: true, valor: true, vencimento: true },
    });

    // groupBy em unidadeId nullable — o filtro `in: unidadeIds` exclui null
    const chamadosPorUnidade = await tenantPrisma.chamado.groupBy({
      by: ['unidadeId'],
      where: { condominioId, unidadeId: { in: unidadeIds }, status: { not: 'RESOLVIDO' } },
      _count: { _all: true },
    });
    const chamadosMap = new Map(
      chamadosPorUnidade
        .filter((c) => c.unidadeId !== null)
        .map((c) => [c.unidadeId as string, c._count._all]),
    );

    const atrasoMap = new Map<string, { totalEmAtraso: number; diasAtraso: number }>();
    const temCobrancaSet = new Set<string>();

    for (const cb of cobrancas) {
      temCobrancaSet.add(cb.unidadeId);
      const inadimplente =
        cb.status === 'ATRASADO' || (cb.status === 'PENDENTE' && cb.vencimento < inicioDeHoje);
      if (inadimplente) {
        const dias = Math.max(
          0,
          Math.floor((inicioDeHoje.getTime() - cb.vencimento.getTime()) / 86_400_000),
        );
        const atual = atrasoMap.get(cb.unidadeId) ?? { totalEmAtraso: 0, diasAtraso: 0 };
        atrasoMap.set(cb.unidadeId, {
          totalEmAtraso: atual.totalEmAtraso + Number(cb.valor),
          diasAtraso: Math.max(atual.diasAtraso, dias),
        });
      }
    }

    return unidades.map((u) => {
      const dados = u.dadosUnidade;
      const flags = dados
        ? Object.entries(NOMES_FLAGS_UNIDADE)
            .filter(([key]) => (dados as Record<string, unknown>)[key] === true)
            .map(([, label]) => label)
        : [];

      return {
        unidadeId: u.id,
        identificador: u.identificador,
        tipo: u.tipo,
        responsavelNome: u.responsavelNome ?? null,
        statusFinanceiro: atrasoMap.has(u.id)
          ? 'INADIMPLENTE'
          : temCobrancaSet.has(u.id)
            ? 'ADIMPLENTE'
            : 'SEM_COBRANCA',
        totalEmAtraso: arredondar(atrasoMap.get(u.id)?.totalEmAtraso ?? 0),
        diasAtraso: atrasoMap.get(u.id)?.diasAtraso ?? 0,
        chamadosAbertos: chamadosMap.get(u.id) ?? 0,
        statusOcupacao: dados?.statusOcupacao ?? null,
        flags,
      };
    });
  }
}
