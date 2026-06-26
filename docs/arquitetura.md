# Arquitetura — Condly

> Este documento é a fonte da verdade sobre a arquitetura do backend.
> `CLAUDE.md`, na raiz do repositório, é só um resumo de navegação que
> aponta para aqui. Se os dois divergirem, atualize este arquivo e depois
> sincronize o resumo — nunca o contrário.

## 1. Visão geral

Condly é um SaaS multi-tenant de gestão condominial. Uma Administradora
contrata o Condly e gerencia, através dele, múltiplos Condomínios; cada
Condomínio tem Unidades, e cada Unidade pode ter um ou mais moradores
(Condôminos) e/ou um Síndico responsável. O sistema é dividido em dois
apps (`apps/web` e `apps/api`, ver `docs/stack.md`) e hoje cobre quatro
áreas de domínio implementadas: autenticação/RBAC, cadastro
(administradoras/condomínios/unidades), financeiro (cobranças via Asaas)
e chamados (manutenção/suporte). Reservas, documentos, avisos e o bot de
WhatsApp estão no schema mas ainda não têm módulo de API.

## 2. Modelo de dados multi-tenant

A hierarquia de tenant é estritamente em árvore, refletida 1:1 no Prisma
schema (`apps/api/prisma/schema.prisma`):

```
Administradora
  └── Condominio (administradoraId)
        └── Unidade (condominioId)
```

Todo modelo de domínio se ancora nessa árvore por uma foreign key direta
(nunca "solta"):

| Modelo        | Ancorado em                          |
|---------------|---------------------------------------|
| Condominio    | `administradoraId`                    |
| Unidade       | `condominioId`                         |
| Chamado       | `condominioId` (+ `unidadeId` opcional)|
| Documento     | `condominioId`                         |
| Aviso         | `condominioId` (+ `unidadeId` opcional)|
| AreaComum     | `condominioId`                         |
| Cobranca      | `unidadeId`                            |
| Reserva       | `unidadeId` (via `areaComumId`)        |
| ConversaBot   | `unidadeId`                            |
| VinculoUsuario| `administradoraId` OU `condominioId` OU `unidadeId` (exatamente um nível, conforme o papel) |

`Usuario` é a única entidade que não pertence a um tenant — ela existe
fora da árvore e se conecta a ela só através de `VinculoUsuario`. Por
isso, lookups de `Usuario` (ex: validar um `responsavelId` de Chamado) não
passam pelo filtro de tenant — não há isolamento a aplicar num modelo que
não tem `administradoraId`/`condominioId`/`unidadeId`.

### Papéis (`PapelVinculo`)

- **ADMINISTRADORA**: vínculo com `administradoraId`. Gerencia toda a
  árvore daquela administradora.
- **SINDICO**: vínculo com `condominioId`. Gerencia um condomínio
  inteiro, incluindo todas as unidades dele.
- **CONDOMINO**: vínculo com `unidadeId`. Mora em uma unidade específica.

## 3. Autenticação

`POST /auth/login` valida e-mail/senha (bcrypt) e emite um JWT
(`AuthService`, `apps/api/src/auth/auth.service.ts`) cujo payload carrega
a lista de vínculos do usuário. Cada vínculo no token é **resolvido por
completo** no momento do login: um vínculo de CONDOMINO, que no banco só
tem `unidadeId`, ganha também o `condominioId` da sua própria unidade
(buscado uma única vez, no login, não a cada requisição). Esse
pré-cálculo existe especificamente para o RBAC da seção 4 funcionar —
sem ele, um condômino nunca conseguiria ser autorizado em nenhuma rota de
nível condomínio (ex: abrir um chamado).

`JwtStrategy` (`apps/api/src/auth/strategies/jwt.strategy.ts`) valida o
token em toda rota protegida por `JwtAuthGuard` e popula
`request.user: AuthenticatedUser`.

## 4. Isolamento multi-tenant (regra inegociável)

Esta é a seção citada por `CLAUDE.md` — qualquer query Prisma sobre
Condominio, Unidade, Cobranca, Chamado, Documento, Aviso, Reserva,
AreaComum ou ConversaBot precisa passar pelas duas camadas abaixo.

### 4.1 Camada 1 — autorização (`RolesGuard`)

Toda rota anotada com `@Roles(...)` passa por
`apps/api/src/auth/rbac/roles.guard.ts`, que:

1. Resolve o **escopo do recurso** acessado a partir dos parâmetros da
   rota (`TenantScopeResolverService`,
   `apps/api/src/auth/rbac/tenant-scope-resolver.service.ts`) — por
   exemplo, `:unidadeId` na URL é resolvido para
   `{ administradoraId, condominioId, unidadeId }` subindo a árvore a
   partir da Unidade. A mesma lógica existe para `:condominioId`,
   `:administradoraId` e `:chamadoId` (este último resolve via
   `Chamado.condominioId`, para suportar rotas como
   `PATCH /chamados/:chamadoId` que não têm `condominioId` na URL).
2. Checa se algum vínculo do usuário autenticado autoriza aquele escopo,
   **por papel** (`vinculoAutoriza`, no mesmo arquivo) — não é "qualquer
   campo do vínculo que bater":
   - ADMINISTRADORA autoriza por `administradoraId`.
   - SINDICO autoriza por `condominioId` (cobre as unidades do
     condomínio também).
   - CONDOMINO autoriza por `unidadeId` quando o recurso é de uma
     unidade específica, ou por `condominioId` (resolvido no login, ver
     seção 3) quando o recurso é de nível condomínio sem unidade alvo —
     mas nunca ganha acesso a uma unidade que não é a sua.

Se nenhum vínculo autoriza, `403`. Se o recurso referenciado pelos
parâmetros da rota não existe, `404` — **antes** da checagem acima, o
que significa que um usuário autenticado consegue distinguir "não
existe" de "existe em outro tenant" (ver débito técnico, seção 6).

### 4.2 Camada 2 — filtro físico (`TenantInterceptor`)

Depois que o Guard aprova a requisição, `TenantInterceptor`
(`apps/api/src/prisma/tenant.interceptor.ts`) injeta em
`request.tenantPrisma` um Prisma Client estendido
(`buildScopedPrismaClient`, `apps/api/src/prisma/tenant-prisma.ts`) que
reaplica o mesmo escopo resolvido na seção 4.1 em **toda** query Prisma
feita por aquele client — mesmo que o service esqueça de filtrar
manualmente. Os services sempre devem receber e usar esse client (via
`@CurrentTenantPrisma()`), nunca o `PrismaService` "cru", exceto em
lugares que deliberadamente operam fora de um tenant resolvido (ex:
`AuthService.login`, que ainda não sabe a qual tenant o usuário
pertence).

Essa é a segunda linha de defesa: mesmo que um service tenha um bug e
esqueça o `where: { condominioId }`, o client estendido já injeta esse
filtro por fora. As duas camadas são redundantes por design.

## 5. Módulos de domínio implementados

- **auth** (`src/auth`) — login, JWT, RBAC (`rbac/`), guards.
- **administradoras** (`src/administradoras`) — CRUD básico, nível mais
  alto da árvore.
- **condominios** (`src/condominios`) — CRUD, acessível por
  ADMINISTRADORA e SINDICO do próprio condomínio.
- **unidades** (`src/unidades`) — CRUD, acessível por ADMINISTRADORA,
  SINDICO e pelo CONDOMINO da própria unidade.
- **financeiro** (`src/financeiro`) — emissão de cobrança via Asaas
  (sandbox/produção), webhook de confirmação de pagamento, resumo
  financeiro do condomínio. Ver `docs/stack.md` seção 3.2.
- **chamados** (`src/chamados`) — abertura (síndico ou condômino, status
  inicial diferente conforme quem abre), triagem/atualização (síndico),
  listagem com filtro de status (administradora/síndico), evento
  `chamado.status_alterado` via `@nestjs/event-emitter` a cada mudança
  real de status. Decisões de escopo detalhadas em `CLAUDE.md`.

Ainda no schema, sem módulo de API: Documento, Aviso, AreaComum, Reserva,
ConversaBot.

## 6. Débito técnico conhecido

Mantido em `CLAUDE.md` (seção "Débito técnico conhecido") para ficar
junto das outras pendências do projeto — não duplicado aqui para evitar
os dois arquivos divergirem.

## 7. Controle de versão

O projeto passou a ter um repositório git a partir do commit "estado
inicial após Prompts 0-4". Antes disso não havia histórico algum — se
você está lendo isto numa auditoria e precisa de contexto sobre uma
mudança anterior a esse commit, ela não existe em lugar nenhum; a
reconstrução teria que vir da memória de quem trabalhou no projeto, não
do git.
