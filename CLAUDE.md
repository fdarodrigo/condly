# Condly

SaaS de gestão condominial multi-tenant. Administradoras de condomínio
contratam o Condly e oferecem aos seus condomínios (síndicos e
condôminos) financeiro automatizado, chamados, reservas, documentos,
avisos e um bot de WhatsApp.

Documentação completa: `docs/arquitetura.md` e `docs/stack.md`. Leia-os
antes de propor mudanças estruturais — este arquivo é só um resumo de
navegação, não a fonte da verdade.

## Stack
- Frontend: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui,
  como PWA — `apps/web`
- Backend: NestJS + TypeScript + Prisma ORM — `apps/api`
- Banco: PostgreSQL
- Gateway de pagamento: Asaas (sandbox em dev), via subconta por condomínio
- Bot: Meta WhatsApp Cloud API, motor de regras (não LLM livre)

## Comandos
- `docker compose up -d` — Postgres local (condly_dev + condly_test), porta 5433
- `npm run dev` (em cada app) — ambiente local
- `npm run test:unit` (apps/api) — Jest sem tocar banco
- `npm run test:integration` (apps/api) — aplica migrations no banco de
  teste (`TEST_DATABASE_URL`) e roda os specs `*.integration-spec.ts`
- `npm run lint` / `npx tsc --noEmit` — lint e checagem de tipos
- `npx prisma migrate dev` — aplicar migrations no banco de desenvolvimento
- `npm run db:seed` — popular banco de demonstração (ainda não implementado)

## Regra inegociável: isolamento multi-tenant
Toda query que toca Condominio, Unidade, Cobranca, Chamado, Documento,
Aviso, Reserva, AreaComum ou ConversaBot PRECISA passar pelo filtro de
administradoraId/condominioId do interceptor descrito em
docs/arquitetura.md (seção 4). Nunca escreva uma query Prisma "crua"
que ignore esse filtro, mesmo em scripts de debug ou seed. Se não tiver
certeza se uma query está isolada corretamente, use a skill
checar-isolamento-tenant antes de declarar a tarefa concluída.

## Outras regras de domínio
- Webhooks de pagamento (/webhooks/*) sempre validam a assinatura antes
  de processar qualquer payload, mesmo em ambiente de teste.
- Nunca logue o payload completo de uma Cobranca ou de um webhook de
  pagamento — logue apenas IDs e status.
- Campos cadastrais sensíveis (saúde, condição de moradores especiais)
  só podem ser lidos por SINDICO e ADMINISTRADORA, nunca por outro
  CONDOMINO, nem em endpoints genéricos de listagem.
- O bot do WhatsApp é baseado em regras, não em geração livre de texto
  sobre saldo, valores ou dados de terceiros — siga o escopo definido
  em docs/stack.md (seção 3.3).

## Convenção de nomenclatura
Entidades de domínio (Administradora, Condominio, Unidade, Cobranca,
Chamado etc.) ficam em português, espelhando o Prisma schema. Código
genérico (utilitários, helpers sem relação direta com o domínio) segue
a convenção padrão em inglês do ecossistema Node/TypeScript. Não
misture os dois dentro da mesma entidade.

## Débito técnico conhecido (revisão de segurança pós-Prompt 3, reauditado pós-Prompt 4)
Review do tenant-security-reviewer sobre schema + auth/RBAC + financeiro.
Reauditado retroativamente sobre toda a base (Prompts 1-4) após o
commit inicial — nenhum CRÍTICO encontrado nas duas rodadas. Itens
abertos, não ignorar silenciosamente:
- **AVISO** (corrigido): `ChamadosService.atualizar` validava
  `responsavelId` só checando se o `Usuario` existia, sem checar tenant
  — `usuario` não tem `administradoraId`/`condominioId`/`unidadeId`
  direto, então não está em `CONDOMINIO_ID_MODELS`/`UNIDADE_ID_MODELS`
  de `tenant-prisma.ts` e a query rodava sem filtro de tenant. Corrigido
  validando que existe um `VinculoUsuario` para `responsavelId` cujo
  `condominioId`, `administradoraId` (via o condomínio do chamado) ou
  `unidade.condominioId` bate com o condomínio do chamado
  (`chamados.service.ts`, método `atualizar`) — rejeita com 400 caso
  contrário. Cobertura em `chamados.integration-spec.ts` (atribuição
  válida entre níveis do mesmo tenant, e rejeição de usuário de outro
  condomínio/administradora e de usuário sem vínculo nenhum).
- **AVISO** (corrigido): `tenant-prisma.ts` não filtrava Cobranca/Reserva/
  ConversaBot quando o escopo resolvido era só `condominioId` (sem
  `unidadeId`) — ex. rotas `/condominios/:id/*`. Hoje esses modelos só são
  protegidos pela 2ª camada (interceptor) via filtro de relação
  `unidade.condominioId`; antes dependiam 100% do filtro manual no service.
- **AVISO** (aberto): `TenantScopeResolverService` lança `NotFoundException`
  antes da checagem de autorização, então um usuário autenticado consegue
  diferenciar "recurso não existe" (404) de "recurso existe em outro
  tenant" (403) — oracle de enumeração de IDs entre tenants. Não vaza
  dados, só existência. Decisão consciente de não normalizar para sempre
  404 ainda; revisar se isso importar para o domínio (ex. antes de expor
  IDs previsíveis).
- **SUGESTÃO** (aberta): falta de teste que itere o DMMF do Prisma e falhe
  se um novo modelo com administradoraId/condominioId/unidadeId for
  adicionado ao schema sem entrar em `tenant-prisma.ts` — hoje essa
  cobertura é garantida só por revisão manual.
- **SUGESTÃO** (aberta): `processarWebhookPagamento` não loga tentativas de
  webhook com `idExternoGateway` desconhecido — dificulta auditoria caso o
  token de webhook seja comprometido (logar só o id, nunca o payload).

## Decisões de escopo do módulo chamados (Prompt 4, revisado no Prompt B)
- `POST /condominios/:id/chamados`: só SINDICO e CONDOMINO abrem chamado
  (literal do prompt) — ADMINISTRADORA não está autorizada nesse endpoint.
- `GET /condominios/:id/chamados`: ADMINISTRADORA e SINDICO veem todos os
  chamados do condomínio. Desde o Prompt B, CONDOMINO também acessa esta
  rota (mesmo endpoint, sem rota nova), mas `ChamadosService.listar` filtra
  o resultado para só os chamados que ele abriu ou que pertencem à própria
  unidade — nunca chamados de outras unidades do mesmo condomínio. Decisão
  resolvida originalmente deixada em aberto no Prompt 4.
- `PATCH /chamados/:id` agora aplica uma máquina de estados explícita
  (`TRANSICOES_VALIDAS` em `chamados.service.ts`, lista de permissão, não
  bloqueio): PENDENTE_TRIAGEM→ABERTO, ABERTO→EM_ANDAMENTO,
  EM_ANDAMENTO→RESOLVIDO, RESOLVIDO→ABERTO (reabertura). Qualquer outra
  transição (incluindo pular a triagem, voltar de ABERTO para
  PENDENTE_TRIAGEM, ou "transicionar" para o mesmo status atual) é
  rejeitada com 400. Reabertura (RESOLVIDO→ABERTO) grava `reabertoEm` e
  dispara o evento `chamado.reaberto` além do `chamado.status_alterado`
  normal — tratada como operacionalmente distinta de uma transição comum.
- RBAC ganhou checagem por papel (`vinculoAutoriza` em
  `auth/rbac/roles.guard.ts`): CONDOMINO autoriza por `condominioId`
  (resolvido a partir da própria unidade no login) quando o recurso é de
  nível condomínio sem unidade alvo (ex: abrir chamado, listar
  chamados), mas continua restrito à própria unidade quando o recurso é
  de nível unidade — não ganha acesso a outras unidades do mesmo
  condomínio. A restrição de *quais* chamados ele vê na listagem é
  responsabilidade do service (`listar`), não do Guard — o Guard só
  decide se ele pode acessar a rota daquele condomínio.

## Pendência para o Prompt 10 (seed)
`Unidade` ganhou os campos opcionais `responsavelNome`, `responsavelEmail`
e `responsavelCpfCnpj` (ver módulo financeiro). Quando o seed de demonstração
for criado/reexecutado, preencha esses campos com dados fictícios válidos —
sem isso, qualquer cobrança de demonstração roda só em modo sandbox (com
aviso no log) e falha com 422 se `ASAAS_ENV=production`.

## Definição de "pronto"
Uma tarefa só está concluída quando: os testes relevantes passam,
não há erro de tipo, o lint está limpo, e — se a mudança tocou em
Cobranca, Condominio ou qualquer query multi-tenant — a skill
checar-isolamento-tenant foi executada sobre o diff.
