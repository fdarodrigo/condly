import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantPrismaClient } from '../prisma/tenant-prisma';

const CHAMADO_STATUS_ABERTOS = ['PENDENTE_TRIAGEM', 'ABERTO', 'EM_ANDAMENTO'] as const;
const TOP_N_CONDOMINIOS_MAIS_CHAMADOS = 5;
const PROXIMOS_N_SERVICOS = 5;
const RESERVAS_PROXIMOS_DIAS = 7;

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
        END), 0) AS "totalEmAtraso"
      FROM "Condominio" cond
      LEFT JOIN "Unidade" u ON u."condominioId" = cond.id
      LEFT JOIN "Cobranca" cb ON cb."unidadeId" = u.id
      WHERE cond."administradoraId" = ${administradoraId}
      GROUP BY cond.id, cond.nome
    `;

    const condominioIds = rankingFinanceiro.map((linha) => linha.condominioId);
    const nomePorCondominioId = new Map(rankingFinanceiro.map((l) => [l.condominioId, l.nome]));

    const chamadosPorCondominio = await tenantPrisma.chamado.groupBy({
      by: ['condominioId'],
      where: { condominioId: { in: condominioIds }, status: { not: 'RESOLVIDO' } },
      _count: { _all: true },
    });
    const chamadosPendentesPorCondominioId = new Map(
      chamadosPorCondominio.map((linha) => [linha.condominioId, linha._count._all]),
    );

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

    return {
      totalChamadosAbertos,
      rankingArrecadacao,
      rankingInadimplencia,
      condominiosComMaisChamadosPendentes,
    };
  }
}
