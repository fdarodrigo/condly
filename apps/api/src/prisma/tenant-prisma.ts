import { PrismaService } from './prisma.service';

export type TenantScope = {
  administradoraId?: string;
  condominioId?: string;
  unidadeId?: string;
};

const CONDOMINIO_ID_MODELS = [
  'unidade',
  'chamado',
  'documento',
  'aviso',
  'areaComum',
  'servicoPeriodico',
  'acaoAdministrativa',
  'enquete',
  'assembleia',
  'advertencia',
] as const;
const UNIDADE_ID_MODELS = ['cobranca', 'reserva', 'conversaBot', 'dadosUnidade'] as const;

// Operações que aceitam `where` — nunca mexemos em create/createMany, que não têm essa chave.
const WHERE_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

function mergeWhereFilter(extra: Record<string, unknown>) {
  return {
    async $allOperations({ args, query, operation }: any) {
      if (WHERE_OPERATIONS.has(operation)) {
        args.where = { ...(args.where ?? {}), ...extra };
      }
      return query(args);
    },
  };
}

/**
 * Reaplica, na camada do Prisma Client, o mesmo escopo de tenant já autorizado
 * pelo RolesGuard para esta requisição — segunda linha de defesa contra
 * vazamento entre tenants caso algum service esqueça de filtrar manualmente.
 */
export function buildScopedPrismaClient(prisma: PrismaService, scope: TenantScope): PrismaService {
  const query: Record<string, ReturnType<typeof mergeWhereFilter>> = {};

  if (scope.administradoraId) {
    query.administradora = mergeWhereFilter({ id: scope.administradoraId });
    query.condominio = mergeWhereFilter(
      scope.condominioId
        ? { id: scope.condominioId }
        : { administradoraId: scope.administradoraId },
    );

    if (!scope.condominioId) {
      // Rota /administradoras/:id/* (ex: dashboard agregado) sem
      // condominioId resolvido: sem este filtro, Chamado/Documento/Aviso/
      // AreaComum/Unidade/ServicoPeriodico ficariam completamente
      // descobertos pela 2ª camada — só o filtro manual do service os
      // protegeria, igual ao gap já corrigido pra Cobranca/Reserva/
      // ConversaBot em escopo condominioId-only (`else if` abaixo).
      for (const model of CONDOMINIO_ID_MODELS) {
        query[model] = mergeWhereFilter({
          condominio: { administradoraId: scope.administradoraId },
        });
      }
      // Cobranca/Reserva/ConversaBot não têm relação direta com Condominio
      // (só com Unidade), então o filtro precisa de mais um salto na relação.
      for (const model of UNIDADE_ID_MODELS) {
        query[model] = mergeWhereFilter({
          unidade: { condominio: { administradoraId: scope.administradoraId } },
        });
      }
    }
  }

  if (scope.condominioId) {
    for (const model of CONDOMINIO_ID_MODELS) {
      query[model] = mergeWhereFilter({ condominioId: scope.condominioId });
    }
  }

  if (scope.unidadeId) {
    // Escopo mais específico possível: filtro plano por unidadeId.
    query.unidade = mergeWhereFilter({ id: scope.unidadeId });
    for (const model of UNIDADE_ID_MODELS) {
      query[model] = mergeWhereFilter({ unidadeId: scope.unidadeId });
    }
  } else if (scope.condominioId) {
    // Sem unidadeId resolvido (rota condominio-scoped): Cobranca/Reserva/
    // ConversaBot não têm condominioId direto, então filtramos pela relação
    // com Unidade. Sem este `else if`, esses três modelos ficariam sem
    // filtro algum do interceptor em qualquer rota /condominios/:id/*.
    for (const model of UNIDADE_ID_MODELS) {
      query[model] = mergeWhereFilter({ unidade: { condominioId: scope.condominioId } });
    }
  }

  // O client estendido é estruturalmente compatível com PrismaService para as
  // chamadas de CRUD que os services fazem — só não carrega os métodos de
  // ciclo de vida do Nest, que ninguém chama através do client filtrado.
  return prisma.$extends({
    name: 'tenant-scope',
    query,
  } as Parameters<typeof prisma.$extends>[0]) as unknown as PrismaService;
}

export type TenantPrismaClient = PrismaService;
