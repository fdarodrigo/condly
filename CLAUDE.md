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
- `npm run test:unit` — Jest sem tocar banco (apps/api) ou Vitest +
  Testing Library (apps/web)
- `npm run test:integration` (apps/api) — aplica migrations no banco de
  teste (`TEST_DATABASE_URL`) e roda os specs `*.integration-spec.ts`.
  **NUNCA rode `npx jest --config test/jest-integration.json` direto**: é
  o wrapper (`scripts/test-integration.js`) que troca `DATABASE_URL` pelo
  banco de teste — sem ele, os specs conectam no `condly_dev` e o
  `limparBanco` do beforeAll APAGA o banco de desenvolvimento (aconteceu
  de verdade; recuperado com `npm run db:seed`)
- `npm run lint` / `npx tsc --noEmit` — lint e checagem de tipos
- `npx prisma migrate dev` — aplicar migrations no banco de desenvolvimento
- `npm run db:seed` — popular banco de demonstração (`DATABASE_URL`, **apaga
  todo o conteúdo das tabelas de domínio antes de recriar** — nunca rodar
  num banco com dados reais)
- `npm run db:seed:smoke-test` — roda o seed contra `TEST_DATABASE_URL` e
  confere as contagens esperadas de cada entidade (detecta rápido se uma
  mudança no schema quebrou o seed)

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

## Débito técnico conhecido (revisão de segurança pós-Prompt 3, reauditado pós-Prompt 4, pós-Prompt 7, pós-Prompt 8, pós-Prompt 9, pós-Prompt 10.5 e pós-Prompt 10.6)
Review do tenant-security-reviewer sobre schema + auth/RBAC + financeiro.
Reauditado retroativamente sobre toda a base (Prompts 1-4) após o
commit inicial, de novo sobre os módulos de chamados (visibilidade/
máquina de estados), reservas, documentos e avisos (commits `71415f7`
a `c40b4e8`), de novo sobre o módulo de dashboards (Prompt 8), de novo
sobre o módulo de bot do WhatsApp (Prompt 9, com foco extra na regra de
identidade exclusiva por `telefoneWhatsapp`), de novo sobre os dois
endpoints novos que sustentam o frontend (`GET /unidades/me/saldo` e
`GET /condominios/:id/areas-comuns`, Prompt 10.5), e de novo sobre o
único endpoint novo do Prompt 10.6 (`PATCH /avisos/:avisoId/marcar-lido`,
com foco no raciocínio de que a busca pela chave composta
`[avisoId, usuarioId]` substitui qualquer filtro físico de tenant) —
nenhum CRÍTICO encontrado em nenhuma das rodadas. Itens abertos, não
ignorar silenciosamente:
- **SUGESTÃO** (aberta, Prompt 10.5): `UnidadesService.meuSaldo` usa
  `findFirst` em `vinculoUsuario` sem `orderBy` explícito pra escolher
  qual unidade usar quando o usuário tem mais de um vínculo com
  `unidadeId` — mesma limitação já aceita e documentada para
  `BotService.resolverIdentidade` (não é falha de isolamento, a unidade
  retornada é sempre de um vínculo real do próprio usuário, só não há
  critério de desambiguação determinístico entre vínculos legítimos).
- **SUGESTÃO** (aberta, Prompt 10.5): `unidades.integration-spec.ts` só
  cobre o 404 de "usuário sem nenhum vínculo com unidade" (SINDICO puro);
  não há teste explícito pra "vínculo existe mas não é CONDOMINO" como
  caso distinto (comportamento é o mesmo, a rota não filtra por papel de
  propósito — só falta o teste nomeado pra esse caso específico).
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
- **SUGESTÃO** (aberta): `ReservasService.cancelar` não loga quem cancelou
  uma reserva (`reservaId` + papel do usuário) — é soft delete, mas é uma
  operação destrutiva acessível por CONDOMINO, SINDICO e ADMINISTRADORA, e
  hoje não há trilha de auditoria de quem confirmou o cancelamento. Mesmo
  espírito da sugestão acima sobre logging de webhooks.
- **SUGESTÃO** (corrigida): a checagem de "vínculo amplo" (SINDICO do
  condomínio, ou ADMINISTRADORA da administradora DESTE condomínio
  especificamente — não basta ter algum vínculo ADMINISTRADORA, checagem
  que existe desde a correção do Prompt B) estava duplicada, idêntica,
  entre `ChamadosService.listar` e `DocumentosService.temAcessoAmplo`.
  Extraída para `VinculoAmploService` (`auth/rbac/vinculo-amplo.service.ts`,
  exportado por `AuthModule`) — os dois services agora chamam
  `vinculoAmploService.possui(usuario, condominioId, tenantPrisma)`. Sem
  mudança de comportamento: `chamados.integration-spec.ts` e
  `documentos.integration-spec.ts` continuaram passando sem alteração.
- **AVISO** (corrigido, Prompt 8): `tenant-prisma.ts` não tinha NENHUM
  filtro físico para Chamado/Documento/Aviso/AreaComum/Unidade/
  ServicoPeriodico (`CONDOMINIO_ID_MODELS`) nem para Cobranca/Reserva/
  ConversaBot (`UNIDADE_ID_MODELS`) em rotas `/administradoras/:id/*`
  (escopo resolvido só até `administradoraId`, sem `condominioId`) — só o
  filtro manual no service protegia. Não mordeu ninguém até agora porque
  nenhuma rota anterior a `GET /administradoras/:id/dashboard` consultava
  esses modelos nesse nível de escopo (a única rota `/administradoras/:id/*`
  existente, `GET /administradoras/:id`, só toca o próprio model
  `Administradora`, que já era filtrado). Corrigido com um novo branch em
  `buildScopedPrismaClient` que filtra esses modelos por
  `condominio.administradoraId` (ou `unidade.condominio.administradoraId`
  pra Cobranca/Reserva/ConversaBot) quando o escopo é só `administradoraId`
  — mesmo espírito do `else if (scope.condominioId)` já existente pra
  escopo condominioId-only.
- **SUGESTÃO** (corrigida, Prompt 8): `DashboardService.administradora` usava
  `this.prisma.chamado.groupBy` (client cru) em vez do `tenantPrisma`
  resolvido por request — funcionava porque dependia só do `condominioIds`
  já filtrado pela raw query anterior, mas deixava esse `groupBy` sem a 2ª
  camada de defesa que o resto do service tem. Trocado pra `tenantPrisma`
  (controller passa via `@CurrentTenantPrisma()`), aproveitando o branch
  `administradoraId`-only que acabou de ser corrigido em `tenant-prisma.ts`
  (item acima) — antes dessa correção, essa troca não teria efeito nenhum.
- **SUGESTÃO** (aberta, Prompt 9): `BotService` não loga (nem deveria logar
  o texto da mensagem) tentativas de mensagem vindas de um
  `telefoneWhatsapp` sem nenhum `Usuario`/`VinculoUsuario` vinculado —
  dificulta detectar enumeração/spam nessa superfície não autenticada.
  Mesmo espírito das duas sugestões de logging já abertas acima (webhook
  do Asaas, cancelamento de reserva): logar só o telefone (nunca o
  conteúdo da mensagem) seria suficiente.
- **SUGESTÃO** (aberta): a raw query de `DashboardService.administradora`
  (`$queryRaw`) e o `groupBy` adjacente nunca foram cobertos pelo teste que
  itera o DMMF sugerido abaixo, nem por nenhum teste automatizado que falhe
  se alguém remover o `WHERE cond."administradoraId" = ...` — a cobertura
  hoje é só revisão manual + o teste de isolamento manual em
  `dashboard.integration-spec.ts` (que passaria a falhar se o filtro fosse
  removido, mas não de forma óbvia/dirigida ao motivo).
- **SUGESTÃO** (aberta, Prompt 10.6): `AvisosService.marcarComoLido` não
  tem teste explícito de idempotência (marcar como lido um aviso já lido
  duas vezes) — comportamento atual é sobrescrever `lidoEm` com um novo
  timestamp, o que é aceitável, só não está coberto por teste nomeado.
- **AVISO** (aceito, módulo chamados+advertências): `ChamadosService.abrirChamado`
  usa `usuario.vinculos.some((v) => v.papel === 'ADMINISTRADORA')` sem checar
  se o `administradoraId` desse vínculo corresponde ao da rota — o
  `RolesGuard` já garante essa correspondência antes de o service ser chamado,
  então não é exploitável. Code smell documentado conscientemente: o service
  depende do invariante do Guard externo, sem defesa própria, igual ao padrão
  já aceito em outros services (ex: visibilidade de chamados por CONDOMINO
  delegada ao service, não ao Guard). Não normalizar para evitar um DB call
  extra só pra defender algo que o Guard já garantiu.
- **SUGESTÃO** (aberta, módulo advertências): `AdvertenciasService.listarMinhas`
  recebe `tenantPrisma` pelo controller mas na prática é o client cru (sem
  scope) — mesmo padrão de `AvisosService.listarNaoLidos` em
  `GET /usuarios/me/avisos`. O isolamento vem exclusivamente do filtro
  `unidadeId: { in: unidadeIds }` derivado dos vínculos CONDOMINO do JWT
  assinado pelo backend. Não é uma falha; documentado aqui para que refactors
  futuros não confundam o tipo com uma proteção que não existe naquele contexto.
- **SUGESTÃO** (aberta, módulo chamados): `ChamadosService.remover` é hard
  delete sem checagem de status — um chamado `EM_ANDAMENTO` pode ser apagado
  sem rastro. Sem problema de isolamento; se auditoria for exigida futuramente,
  adicionar soft delete ou log (mesmo espírito da sugestão de `ReservasService.cancelar`).

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

## Decisões de escopo do módulo reservas (Prompt 5)
- Rotas adaptadas em relação ao prompt literal para caber no padrão de
  RBAC já estabelecido (toda rota protegida por `@Roles` precisa de um
  parâmetro que `TenantScopeResolverService` saiba resolver):
  - `GET /areas-comuns/:areaComumId/disponibilidade?data=YYYY-MM-DD`
    (`:id` do prompt renomeado para `:areaComumId`, mesmo padrão de
    `:condominioId`/`:unidadeId`/`:chamadoId` já usado nos outros
    módulos).
  - `POST /reservas` do prompt virou
    `POST /areas-comuns/:areaComumId/reservas` — **decisão deliberada,
    não só de nomenclatura**: se a rota fosse aninhada em
    `/unidades/:unidadeId/reservas` em vez de `/areas-comuns/:id`, o
    escopo resolvido teria `unidadeId` fixo, e o filtro físico do
    tenant (`tenant-prisma.ts`) injetaria `unidadeId` em toda query de
    `Reserva` — inclusive na checagem de conflito, que precisa ver as
    reservas de TODAS as unidades do condomínio na mesma área comum,
    não só as da unidade que está reservando. Aninhar em
    `/areas-comuns/:id` resolve escopo só até `condominioId`, e o
    filtro físico cobre `Reserva` via `unidade.condominioId` — o
    correto para essa checagem.
  - `DELETE /reservas/:id` manteve o formato do prompt, só renomeando
    `:id` para `:reservaId` — resolvido via novo branch em
    `tenant-scope-resolver.service.ts` (Reserva → Unidade → Condomínio,
    igual ao padrão já usado para `chamadoId`).
- CONDOMINO só reserva em nome da própria unidade (rejeitado com 403 se
  informar `unidadeId` de outra unidade no corpo); SINDICO e
  ADMINISTRADORA podem reservar em nome de qualquer unidade do
  condomínio, informando `unidadeId` explicitamente.
- `Reserva.status` deixou de ser `String` livre e passou a enum
  `StatusReserva` (`CONFIRMADA` | `CANCELADA`), seguindo o padrão já
  usado em `Cobranca`/`Chamado`. Cancelamento é soft delete (`DELETE`
  só atualiza o status, nunca remove a linha) — cancelar uma reserva já
  cancelada é rejeitado com 400.
- `regrasReserva` (`Json` em `AreaComum`) tem o formato
  `{ horarioAbertura, horarioFechamento, duracaoMinimaMinutos,
  antecedenciaMaximaDias }` — ainda não documentado/validado por DTO
  porque não existe endpoint de cadastro de `AreaComum` neste prompt
  (criada só via seed/script); se um endpoint de cadastro for criado,
  validar esse shape explicitamente em vez de confiar no formato.
- Conflito de horário na criação retorna 409 (não 400) com
  `sugestoes` — até 3 horários livres no mesmo dia, ordenados por
  proximidade ao horário pedido (não cronologicamente a partir da
  abertura).

## Decisões de escopo do módulo documentos (Prompt 6)
- Cliente de storage segue o mesmo padrão do Asaas em `financeiro/`: uma
  interface (`R2Client` em `documentos/storage/r2-client.interface.ts`) com
  token de DI `R2_CLIENT`, uma implementação real via S3 SDK
  (`R2S3Client`, compatível com R2 por endpoint customizado) e um fake
  (`test/helpers/fake-r2-client.ts`) injetado via `overrideProvider` nos
  testes de integração — nenhum teste depende de rede ou credenciais reais.
- `Documento.visibilidade` deixou de ser `String` livre e passou a enum
  `VisibilidadeDocumento` (`TODOS` | `SINDICO_ADMINISTRADORA`), seguindo o
  padrão já usado em `Chamado`/`Reserva` — a lógica de RBAC depende do
  valor exato, então um enum fechado evita um typo silenciosamente
  liberando ou restringindo acesso. `tipo` continua `String` livre (não há
  lógica de autorização condicionada a ele, só o agrupamento visual no
  frontend).
- `Documento.urlArquivo` guarda a **key do objeto no R2**, não uma URL
  pública — o campo manteve o nome do schema original, mas o valor nunca é
  servido diretamente. Acesso é sempre via signed URL de curta duração
  gerada sob demanda (`GET /documentos/:documentoId/download-url`),
  nunca por um link permanente — decisão deliberada, não só de
  nomenclatura, já que uma URL pública e permanente quebraria o controle
  de visibilidade após a primeira geração.
- `POST /condominios/:condominioId/documentos/upload-url` só aceita
  SINDICO e ADMINISTRADORA — CONDOMINO não cadastra documentos oficiais
  do condomínio (ata, prestação de contas etc.), só consome. `contentType`
  é validado contra uma lista de permissão (`TIPOS_MIME_PERMITIDOS` em
  `criar-upload-url.dto.ts`: PDF, JPEG, PNG) — sem isso, a signed URL
  assinaria upload de qualquer `Content-Type` arbitrário para um objeto
  que depois pode ser baixado por outro usuário do mesmo condomínio.
- `GET /condominios/:condominioId/documentos` e
  `GET /documentos/:documentoId/download-url` ficam abertos a
  ADMINISTRADORA/SINDICO/CONDOMINO no nível do Guard (igual ao padrão já
  usado em chamados) — a restrição por `visibilidade` é responsabilidade
  do `DocumentosService` (`temAcessoAmplo`, espelhando `vinculoAmplo` de
  `ChamadosService.listar`), não do Guard: CONDOMINO só vê/baixa
  documentos `TODOS`, nunca `SINDICO_ADMINISTRADORA`, mesmo que o vínculo
  autorize o acesso à rota daquele condomínio.
- `:id` do prompt em `GET /documentos/:id/download-url` renomeado para
  `:documentoId`, mesmo padrão de `:reservaId`/`:chamadoId` — resolvido
  via novo branch em `tenant-scope-resolver.service.ts`
  (Documento → Condomínio).
- Expiração da signed URL de download é fixa em 300s (5 minutos),
  constante em `DocumentosService`. O teste de integração verifica a
  regra observando o parâmetro `expiresInSeconds` recebido pelo
  `FakeR2Client`, não esperando o tempo real passar — a expiração real é
  responsabilidade do SDK do S3/R2, fora do escopo do backend.

## Decisões de escopo do módulo avisos (Prompt 7)
- Novo model `AvisoLeitura` (uma linha por par aviso/destinatário, `lidoEm`
  null = não lido) sustenta o canal APP e `GET /usuarios/me/avisos`. Não
  tem `condominioId`/`unidadeId` próprio, então não entra em
  `CONDOMINIO_ID_MODELS`/`UNIDADE_ID_MODELS` de `tenant-prisma.ts` — o
  tenant já foi validado no momento da criação (`AvisosService` só grava
  linha pros usuários que de fato têm vínculo no escopo do aviso, resolvido
  a partir do `condominioId`/`unidadeId` já validado da rota), mesmo padrão
  de exceção documentado para `vinculoUsuario` no item de débito técnico
  abaixo (responsavelId do chamado).
- `GET /usuarios/me/avisos` é uma rota "minha conta": não tem
  `condominioId` no path pro `TenantScopeResolverService` resolver (um
  usuário pode ter vínculo com vários condomínios). Por isso o handler
  não leva `@Roles` (o `RolesGuard` libera direto, sem checar escopo) nem
  passa pelo `tenantPrisma` resolvido — o filtro de tenant aqui é a própria
  igualdade `usuarioId = usuário logado` em `AvisosService.listarNaoLidos`,
  que é estritamente mais específico que um filtro por tenant.
- Destinatários de um aviso são SINDICO + CONDOMINO do escopo, nunca
  ADMINISTRADORA — quem cria o aviso é normalmente a própria
  administradora, então notificá-la do próprio aviso não faz sentido.
  Escopo "unidade específica" (`dto.unidadeId` informado) notifica só o(s)
  CONDOMINO daquela unidade, nem o síndico nem outras unidades; escopo
  "condomínio inteiro" (sem `unidadeId`) notifica o síndico do condomínio e
  todo CONDOMINO de qualquer unidade dele.
- Canal EMAIL usa a Resend API (`avisos/email/`, mesmo padrão do client do
  Asaas: interface + implementação HTTP real + fake injetado via
  `overrideProvider` nos testes). O nome de exibição do remetente é o nome
  da Administradora (`condominio.administradora.nome`) — co-branding leve
  — mas o endereço de envio em si (`RESEND_FROM_EMAIL`) é fixo, porque é o
  único domínio verificado na conta Resend; a Administradora não tem
  domínio próprio cadastrado lá.
- Canal WHATSAPP só chama `WhatsappClient.enviarAvisoWhatsapp(aviso)` — no
  Prompt 7 era um stub deliberado (`WhatsappStubClient`) que não fazia nada
  e nunca lançava erro. Desde o Prompt 9, o provider real
  (`WhatsappCloudApiAvisoClient`) está em produção e o stub foi removido —
  ver decisões do módulo bot abaixo.
- Cada canal selecionado em `canais` dispara seu efeito de forma
  independente: sem EMAIL, nenhum e-mail é enviado mesmo que haja
  destinatários; sem APP, nenhuma `AvisoLeitura` é criada (o aviso nunca
  aparece em `GET /usuarios/me/avisos`, mesmo tendo sido enviado por
  EMAIL/WHATSAPP).

## Decisões de escopo do módulo dashboard (Prompt 8)
- Novo model `ServicoPeriodico` (`condominioId`, `nome`, `proximoVencimento`)
  não existia em nenhum prompt anterior — criado minimamente só pra
  sustentar "próximos vencimentos de serviços periódicos" no dashboard por
  condomínio. Mesmo padrão já usado pra `AreaComum` no Prompt 5: sem
  endpoint de cadastro neste prompt, criado só via seed/script/teste; se um
  endpoint de cadastro for criado depois, validar o shape explicitamente.
  Entra em `CONDOMINIO_ID_MODELS` de `tenant-prisma.ts` (tem `condominioId`
  direto, igual a `Documento`/`Aviso`/`AreaComum`).
- "Chamados abertos" (tanto o `chamadosPorStatus` do dashboard por
  condomínio quanto o `totalChamadosAbertos`/`condominiosComMaisChamados
  Pendentes` do dashboard agregado) é definido como status ≠ `RESOLVIDO`
  (`PENDENTE_TRIAGEM` + `ABERTO` + `EM_ANDAMENTO`) — o prompt não
  especifica isso explicitamente, mas chamado resolvido não é "aberto" em
  nenhuma leitura razoável da palavra. `chamadosPorStatus` retorna só essas
  3 chaves (nunca `RESOLVIDO`).
- `GET /condominios/:condominioId/dashboard`: ADMINISTRADORA e SINDICO,
  igual ao padrão de `GET /condominios/:id/financeiro/resumo` — CONDOMINO
  não vê totais financeiros do condomínio inteiro.
- `GET /administradoras/:administradoraId/dashboard`: só ADMINISTRADORA —
  nem SINDICO de um dos condomínios da carteira acessa essa visão agregada
  (ele só gerencia o(s) próprio(s) condomínio(s), não a carteira inteira).
- Dashboard agregado otimizado pra 2 queries totais, sempre, independente
  do número de condomínios da administradora (ver teste dedicado de
  contagem de queries via `prisma.onQuery`, comparando 3 vs. 100
  condomínios e exigindo igualdade):
  1. Uma raw query (`$queryRaw`, injetada via `Prisma.sql` template,
     parâmetros sempre bindados — nunca interpolação de string) que faz
     `LEFT JOIN Condominio → Unidade → Cobranca` e soma, com `CASE WHEN`
     condicional no banco, recebido-no-mês / a-receber-no-mês / em-atraso
     por condomínio — só assim dá pra obter um total por condomínio sem um
     `groupBy` do Prisma (que não alcança `Cobranca.unidade.condominioId`,
     uma relação indireta) nem buscar todas as cobranças da carteira e
     somar em JS (que escalaria com o volume de cobranças, não só de
     condomínios, mas ainda assim violaria "agregação no nível do banco").
     **Atenção, débito de isolamento**: `$queryRaw`/`$executeRaw` NÃO
     passam pelo filtro físico de `tenant-prisma.ts` (a extensão do Prisma
     Client só intercepta operações de modelo, não SQL cru) — por isso o
     `WHERE cond."administradoraId" = ${administradoraId}` é manual e
     **obrigatório** na query, e usa `this.prisma` (client cru), nunca
     `tenantPrisma`, pra não sugerir uma proteção que não existe ali.
  2. Um `groupBy` do Prisma em `Chamado` por `condominioId`, filtrado pelos
     `condominioId`s que já saíram da query acima (nenhuma query extra pra
     descobri-los) — cobre `totalChamadosAbertos` e
     `condominiosComMaisChamadosPendentes` de uma vez.
  - Esse "dashboard agregado sem N+1" foi a primeira rota a precisar de
    escopo `administradoraId`-only tocando esses modelos — ver o item de
    débito técnico corrigido em `tenant-prisma.ts` acima.
- `taxaArrecadacao` é `null` (não `0`) quando não há nada a receber no mês
  pra aquele condomínio — `0%` de arrecadação e "não há dado" são
  afirmações diferentes. No `sort` do ranking, `null` é tratado como o
  pior valor (vai pro fim da lista).
- `rankingArrecadacao`/`rankingInadimplencia` retornam TODOS os condomínios
  da carteira, ordenados; `condominiosComMaisChamadosPendentes` é truncado
  no top 5 — o primeiro par é uma classificação completa ("ranking"),
  o segundo é deliberadamente um destaque ("lista... com mais").
- `PrismaService` ganhou `log: [{ emit: 'event', level: 'query' }]` e um
  método `onQuery(callback)` (encapsula um cast pontual — `extends
  PrismaClient` sem o generic `<'query'>` perde a tipagem de `$on`, e
  tentar `extends PrismaClient<'query'>` resolve o type argument contra a
  sobrecarga errada do client gerado). Sem listener attached, não tem
  custo nenhum em produção; usado só pelo teste de contagem de queries.

## Decisões de escopo do módulo bot (Prompt 9)
- **Regra de identidade inegociável**: a autoridade de quem está
  conversando vem EXCLUSIVAMENTE do `telefoneWhatsapp` da mensagem
  entrante, resolvido contra `Usuario` → `VinculoUsuario` (com
  `unidadeId` não nulo) → `Unidade`, em `BotService.resolverIdentidade` —
  nunca de qualquer afirmação no texto da mensagem (`reconhecerIntencao`
  jamais lê número de unidade ou papel do texto; isso é estrutural, não
  só uma heurística). Defesa em duas camadas: (1) `reconhecerIntencao`
  (`bot/intencoes/reconhecer-intencao.ts`) roda um denylist de frases
  suspeitas de manipulação ("ignore as regras anteriores", "sou o
  síndico", "me dê acesso total", "modo administrador"...) ANTES de
  qualquer palavra-chave, forçando `DESCONHECIDA` mesmo que a mensagem
  também contenha "saldo"/"reservar"/"chamado"; (2) mesmo que uma frase de
  manipulação escape do denylist, nenhum handler de intenção em
  `BotService` jamais extrai unidade/papel do `texto` — só do telefone.
  Testes adversariais cobrindo isso em `reconhecer-intencao.spec.ts`
  (unitário) e `bot.integration-spec.ts` (ponta a ponta, com `ConversaBot`
  e resposta real do bot).
- `POST /webhooks/whatsapp` e o `GET` de verificação seguem o padrão já
  estabelecido pro webhook do Asaas (CLAUDE.md, "Outras regras de
  domínio"): valida ANTES de processar qualquer payload, mesmo em teste.
  Aqui a validação é HMAC-SHA256 (`X-Hub-Signature-256`, ver
  `bot/whatsapp-signature.util.ts`) sobre o corpo CRU — exigiu habilitar
  `rawBody: true` em `NestFactory.create` (`main.ts`) e nos testes de
  integração (`moduleRef.createNestApplication({ rawBody: true })`),
  porque o HMAC precisa dos bytes exatos recebidos, antes do
  parse/transform do `ValidationPipe`. Essa superfície é a mais exposta do
  sistema (não autenticada — qualquer telefone pode mandar mensagem), por
  isso a checagem de assinatura é ainda mais inegociável que a do Asaas.
- Cliente HTTP da Meta Cloud API (`whatsapp/whatsapp-cloud-api-*`) é
  deliberadamente uma camada separada do `WhatsappClient` de Avisos
  (`avisos/whatsapp/whatsapp-client.interface.ts`): `WhatsappCloudApiClient`
  só sabe "enviar texto pra um número" (token de DI
  `WHATSAPP_CLOUD_API_CLIENT`, real via `WhatsappCloudApiHttpClient`, fake
  via `test/helpers/fake-whatsapp-cloud-api-client.ts`), e é reusado tanto
  por `WhatsappCloudApiAvisoClient` (canal WHATSAPP de Aviso) quanto por
  `BotService` — evita duplicar a chamada HTTP à Graph API em dois lugares
  com o mesmo padrão de DI já usado pra Asaas/R2/Resend.
- `Cobranca` ganhou `linkPagamento` (nullable) pra sustentar "envia o link
  de 2ª via" do fluxo de saldo — capturado de `invoiceUrl` na resposta real
  do Asaas na criação da cobrança (`AsaasClient.criarCobranca`), nunca
  reconstruído a partir de um padrão de URL assumido. Cobranças criadas
  antes desse campo existir ficam com `linkPagamento: null`; o bot
  responde o saldo mesmo assim, só omitindo a linha da 2ª via.
- "Cobrança pendente mais recente" (não existe `criadoEm` em `Cobranca`)
  é interpretada como a cobrança com status `PENDENTE` ou `ATRASADO` de
  maior `vencimento` (`ORDER BY vencimento DESC LIMIT 1`) — a mais
  relevante pra "quanto devo" dado o ciclo de cobrança mensal.
- "Reservar" e "chamado" só **iniciam o fluxo** (literal do prompt:
  "inicia", não "completa") — o bot responde com uma orientação textual
  (área comum encontrada/não encontrada, ou instrução pra abrir o chamado
  pelo app), mas não cria `Reserva`/`Chamado` nem implementa máquina de
  estados de conversa multi-turno; isso é escopo deliberadamente fora
  deste prompt. Pra "reservar", o nome da área comum é extraído do texto
  só pra fins de BUSCA em `AreaComum.nome` (`contains`, `insensitive`,
  preservando acentos — diferente da normalização sem-acento usada pro
  denylist de segurança, que tem outro propósito) dentro do
  `condominioId` resolvido pelo telefone — nunca usado pra decidir
  autorização.
- `ConversaBot.unidadeId` passou a nullable (migração
  `20260627152410_bot_whatsapp`) porque toda mensagem é registrada,
  inclusive de telefone sem nenhum vínculo (`BotService` orienta o
  cadastro pelo app nesse caso). Uma conversa por telefone é reaproveitada
  entre mensagens (`ConversaBot.findFirst` por `telefoneWhatsapp`, mais
  recente primeiro) em vez de criar uma linha nova a cada troca; se a
  conversa começou sem vínculo e a identidade resolve depois,
  `unidadeId` é religado — nunca o contrário (uma conversa já vinculada
  nunca volta a ficar sem unidade). Continua fora de
  `CONDOMINIO_ID_MODELS`/`UNIDADE_ID_MODELS` de `tenant-prisma.ts`: o
  webhook não tem requisição autenticada/tenant resolvido por
  `TenantScopeResolverService` (é `BotService` usando `PrismaService` cru,
  mesmo padrão de `FinanceiroService.processarWebhookPagamento`), então
  não haveria escopo nenhum pra injetar ali — o isolamento aqui vem
  inteiramente da regra de identidade acima, não do filtro físico.
- **Limitação conhecida, não corrigida**: se um `Usuario` tiver mais de um
  `VinculoUsuario` com `unidadeId` (ex: dono de duas unidades),
  `resolverIdentidade` usa o primeiro encontrado, sem critério de
  desambiguação — não é uma falha de isolamento (a unidade usada é sempre
  uma unidade real do próprio usuário daquele telefone), mas pode
  responder pela unidade "errada" entre as duas legítimas. Fora de escopo
  deste prompt; revisar se o produto passar a tratar multi-unidade por
  telefone como caso comum.

## Decisões de escopo do seed de demonstração (Prompt 10)
- `prisma/seed.ts` exporta `seed(prisma: PrismaService)` (lógica pura,
  reaproveitável) e só executa via CLI no bloco `if (require.main ===
  module)` no rodapé — permite que `scripts/verify-seed-counts.ts` (smoke
  test) chame a mesma função direto, sem subir um processo novo, e
  garante que `npx prisma db seed` (configurado em `migrations.seed` de
  `prisma.config.ts`, comando `ts-node prisma/seed.ts`) e
  `npm run db:seed` rodam exatamente o mesmo código.
- O seed começa chamando `limparBanco` (reaproveitado de
  `test/helpers/cleanup-database.ts`, mesma ordem segura de FK já usada
  pelos testes de integração) — **apaga TODO o conteúdo das tabelas de
  domínio antes de recriar o cenário fixo**, não faz upsert incremental.
  Decisão deliberada: torna o seed idempotente (rodar de novo nunca colide
  com `Condominio.cnpj`/`Usuario.email` únicos da execução anterior) ao
  custo de ser destrutivo — aceitável porque a finalidade explícita do
  comando é "popular banco de demonstração", nunca preservar dados reais.
  Por isso reaproveita o helper de teste em vez de duplicar a lista de
  `deleteMany` em ordem de FK: é o mesmo tipo de operação (wipe completo
  num banco descartável/de demo), só num arquivo fora de `test/`.
- Datas (vencimento de cobrança, período de atraso, datas de reserva, data
  de envio de aviso) são calculadas relativas a `new Date()` no momento da
  execução, nunca hardcoded — o seed produz o mesmo cenário coerente
  ("12 cobranças pagas, 4 pendentes, 2 atrasadas há mais de 10 dias, tudo
  no mês atual") em qualquer dia em que for executado. Quando "hoje" cai
  nos primeiros dias do mês, o clamp pro início do mês pode deixar uma
  cobrança "atrasada" com menos de 10 dias de atraso — tradeoff documentado
  no código (`criarCobrancas`), aceitável só porque é dado de demonstração.
- Cobranças do seed são inseridas direto via `prisma.cobranca.create`
  (nunca passam por `FinanceiroService`/`AsaasClient`) — o seed nunca faz
  chamada de rede. `Unidade.responsavelCpfCnpj` é preenchido com um CPF de
  formato plausível só pra satisfazer a pendência documentada
  anteriormente aqui (campo não fica vazio), mas **não é um CPF
  validável por dígito verificador real** — irrelevante pro seed porque
  ele nunca aciona a validação de produção do Asaas.
- `npm run db:seed:smoke-test` (`scripts/seed-smoke-test.js` +
  `scripts/verify-seed-counts.ts`) roda contra `TEST_DATABASE_URL`, nunca
  `DATABASE_URL` — mesmo banco descartável de `test:integration` — e falha
  com exit code != 0 se qualquer contagem (`Administradora`, `Condominio`,
  `Unidade`, `Usuario`, `VinculoUsuario`, `Cobranca` por status, `AreaComum`,
  `Reserva`, `Chamado` por status, `Aviso`, `AvisoLeitura`) não bater com o
  esperado — não é uma suíte Jest (não precisa, é só uma checagem rápida de
  regressão pro seed), mas faz parte do mesmo gate de "definição de pronto"
  de qualquer mudança que toque o schema.
- **AVISO corrigido**: `migrations.seed` em `prisma.config.ts` faz `npx
  prisma migrate dev`/`migrate reset` disparar o seed automaticamente
  contra qualquer `DATABASE_URL` no momento, sem nenhuma trava própria.
  Como o seed é destrutivo (`limparBanco` antes de popular), `main()` em
  `prisma/seed.ts` (`validarBancoDeDesenvolvimento`) recusa rodar se
  `DATABASE_URL` não contiver `_dev`/`_test` — hoje o produto só tem
  `condly_dev`/`condly_test` locais, então nunca trava o uso legítimo, mas
  vira rede de segurança no dia em que existir staging/produção com outro
  padrão de nome. Reforçar essa trava (ex: variável explícita) se um
  ambiente real com dados de tenants existir antes desse padrão de nome
  ser revisado.
- **AVISO corrigido (Prompt 10.75)**: `criarCobrancas` distribuía status
  por faixa contígua de índice (`PAGO` = primeiros 12, `PENDENTE`/
  `ATRASADO` = últimos 6) sobre o array `unidades` — e os 3 condôminos de
  demonstração são sempre vinculados às 3 primeiras unidades desse mesmo
  array (`criarUsuarios`). Resultado: as 3 unidades dos logins de
  condômino caíam inteiras no bloco `PAGO` só por serem os primeiros
  índices — nenhum dos 5 logins de demonstração tinha uma `Cobranca`
  pendente/atrasada pra mostrar em `/minha-unidade` (achado da confirmação
  de dados de demonstração, ver seção "Dados de demonstração" do
  README.md). Corrigido trocando os ranges contíguos por listas
  explícitas de índice (`INDICES_PAGO`/`INDICES_PENDENTE`/
  `INDICES_ATRASADO`) que deixam as unidades 0, 1 e 2 (101/102/103, dos 3
  condôminos) fora do bloco `PAGO` de propósito — contagens totais por
  status (12/4/2) inalteradas, só mudou qual unidade recebe qual status,
  então `verify-seed-counts.ts` não precisou de nenhuma alteração.

## Decisões de escopo do frontend e infra de dev (Prompt 10.5)
- `apps/web` saiu do scaffold puro do Prompt 0 pra ganhar a casca da
  aplicação e as 4 telas mínimas pra sustentar os fluxos E2E do Prompt
  11: `/login`, `/dashboard` (SINDICO/ADMINISTRADORA), `/minha-unidade`
  e `/reservas` (CONDOMINO). Identidade visual fixa em claro (fundo
  branco/cinza claro, wordmark "Cond" + "ly" em verde `#0F6E56`) — nunca
  usa a variante `dark:` do tema do shadcn (que já vinha configurado no
  scaffold); nenhuma página/componente novo deste prompt depende de
  `.dark` no `<html>`, então o produto continua sem modo escuro por
  decisão, não por omissão.
- `src/lib/api-client.ts` é o único ponto que monta requisições HTTP pro
  backend: injeta `Authorization: Bearer <token>` (lido de
  `localStorage` via `src/lib/auth.ts`) e redireciona pra `/login` em
  qualquer 401 — **exceto** quando a chamada passa
  `ignorarRedirecionamento401: true`, usado só por `POST /auth/login`
  (que também responde 401 pra credencial inválida, e nesse caso não é
  "sessão expirada", é erro de formulário; sem essa flag o
  `LoginForm` nunca veria a mensagem de erro real, só seria
  redirecionado de volta pra própria tela de login).
- `src/lib/auth.ts` decodifica o JWT só lendo o payload (base64url, sem
  validar assinatura) pra decidir UX — pra onde redirecionar depois do
  login, o que esconder/mostrar por papel. Isso nunca é tratado como
  fonte de autorização real: toda chamada de API que importa passa pelo
  RBAC do backend de qualquer forma, e um token adulterado só engana a
  UI (esconde/mostra menu errado), nunca destrava uma chamada de API que
  o backend não autorizaria de verdade.
- Proteção de rota em duas camadas, ambas client-side e ambas só UX (ver
  comentário no código de cada uma): `app/(app)/layout.tsx` redireciona
  pra `/login` se não há accessToken nenhum; `RequireRole` (usado dentro
  de cada página, não no layout compartilhado, porque cada página exige
  um papel diferente) redireciona pra própria home do papel logado se o
  usuário tentar acessar a página de outro papel (ex: condômino abrindo
  `/dashboard` direto pela URL).
- A barra lateral lista Dashboard/Reservas/Documentos/Avisos pra
  qualquer papel, sem filtrar por permissão — `RequireRole` já cobre a
  parte de "não deixar entrar"; filtrar os itens do menu também seria
  redundante. Documentos e Avisos ainda não têm página (chegam no Prompt
  10.6); o link já existe, apontando pra uma rota inexistente (404 até
  lá) — comportamento esperado, não um bug.
- `/dashboard` consome **três** endpoints, não só
  `GET /condominios/:id/dashboard` (o nome citado no prompt original):
  `GET /condominios/:id/financeiro/resumo` pros três números pedidos
  literalmente ("total a receber, total recebido, lista de
  inadimplentes" — exatamente os três campos que esse endpoint já
  retorna) e `GET /condominios/:id/chamados` pra lista de chamados com
  status. O endpoint `.../dashboard` em si (Prompt 8) não tem nenhum dos
  dois — só agregados (`totalArrecadadoNoMes`/`totalEmAtraso`) e
  contagem de chamados por status, não a lista propriamente. Decisão
  deliberada de composição no frontend em vez de alterar um endpoint já
  testado (`dashboard.integration-spec.ts`) pra caber no nome citado.
- O formulário de abrir chamado em `/dashboard` só aparece pra SINDICO
  (`temPapel(vinculos, ['SINDICO'])`), nunca pra ADMINISTRADORA — mesmo
  os dois acessando a mesma página — porque `POST
  /condominios/:id/chamados` já é restrito a SINDICO/CONDOMINO desde o
  Prompt 4 (ADMINISTRADORA não abre chamado). Mostrar o formulário pra
  ADMINISTRADORA daria 403 ao submeter; melhor nem mostrar.
- `/dashboard` resolve o `condominioId` a partir do primeiro vínculo do
  JWT que tiver `condominioId` (cobre SINDICO, o único papel exercitado
  pelo E2E do Prompt 11 nesta tela). Não existe endpoint de "listar
  condomínios da administradora" pra resolver o caso de uma
  ADMINISTRADORA-de-carteira sem vínculo de condomínio direto — fora de
  escopo deste prompt; a tela degrada pra uma mensagem informativa em
  vez de quebrar nesse caso.
- Dois endpoints novos no backend, faltantes antes deste prompt (mesmo
  espírito do `GET /unidades/me/saldo` pedido explicitamente):
  - `GET /unidades/me/saldo` (`UnidadesController`/`UnidadesService`) —
    rota "minha conta" (sem `@Roles`, mesmo padrão de
    `GET /usuarios/me/avisos`), precisa vir ANTES de `GET ':unidadeId'`
    no controller pra não ser capturada como path param literal `"me"`.
    Resolve a unidade exclusivamente a partir do `usuarioId` do JWT →
    `VinculoUsuario` com `unidadeId` não nulo (sem filtrar por papel,
    mesmo padrão de `BotService.resolverIdentidade`) → `Cobranca`
    `PENDENTE`/`ATRASADO` de maior `vencimento`.
  - `GET /condominios/:condominioId/areas-comuns` (`ReservasController`)
    — não existia nenhum endpoint de leitura de `AreaComum` até aqui
    (criada só via seed/script); precisa existir pra `/reservas` ter algo
    pra colocar no seletor sem hardcodar um id de área comum (que muda a
    cada reseed). Mesmas roles de `disponibilidade`/`criar`.
- `/reservas` usa um `<select>` nativo pro seletor de área comum, não o
  componente `Select` do shadcn (baseado em `@base-ui/react/select`,
  popover customizado) — decisão deliberada pensando no Prompt 11: um
  `<select>` nativo é trivial de dirigir via Playwright
  (`selectOption()`), enquanto um popover customizado exigiria localizar
  e interagir com a lista flutuante. O componente `select.tsx` gerado
  pelo `shadcn add` foi removido por não ter nenhum uso (ver decisão
  acima — não tem nenhum lugar nesta tela que precise dele).
- Data padrão de `/reservas` é "amanhã", não "hoje" — a API rejeita
  reserva com `inicio` no passado, mas `ReservasService.disponibilidade`
  calcula `livres` só descontando reservas já confirmadas, **nunca**
  descontando o horário atual do dia (um slot de hoje às 08h aparece
  como "livre" mesmo às 15h). "Amanhã" evita esse caso de borda sem
  precisar mexer no endpoint.
- Depois de confirmar uma reserva, a tela refaz o `GET disponibilidade`
  e mostra o mesmo horário agora em "ocupados" (rotulado "Reservado") —
  não existe endpoint de "minhas reservas", então "ver a reserva
  aparecer no calendário" (Prompt 11) é literalmente isso: o mesmo
  endpoint de disponibilidade, re-consultado, já reflete o novo estado.
- **Infra de dev corrigida, bloqueava `npm run dev` de verdade** (achado
  só agora porque nenhum prompt anterior precisou subir o servidor de
  desenvolvimento de fato, só via `Test.createTestingModule()` nos
  testes):
  1. Nesta monorepo com npm workspaces, `@nestjs/core` fica hoisted pra
     `node_modules` da raiz, mas `@nestjs/platform-express` permanece só
     em `apps/api/node_modules` (decisão do resolvedor do npm, não muda
     mesmo com reinstall limpo) — o auto-detect de adapter HTTP do
     `NestFactory.create()` faz um require dinâmico de
     `@nestjs/platform-express` a partir de onde `@nestjs/core` está, e
     nunca encontra. Corrigido passando um `ExpressAdapter` explícito em
     `main.ts` (`NestFactory.create(AppModule, new ExpressAdapter(),
     ...)`), que resolve o pacote a partir do próprio `main.ts` (em
     `apps/api/src`), onde ele está garantido.
  2. `main.ts` não carregava `.env` nenhum (`ConfigModule.forRoot()` só
     tem efeito já dentro do ciclo de instanciação do Nest — tarde
     demais pra `AuthModule`, que chama `JwtModule.register({ secret:
     process.env.JWT_SECRET })` de forma síncrona/eager na avaliação do
     decorator `@Module()`, durante o próprio `require()` da árvore de
     módulos). Sem `JWT_SECRET`, login funcionava nos testes (que
     carregam `.env` por fora, via `scripts/test-integration.js`) mas
     falhava com `secretOrPrivateKey must have a value` em
     `npm run dev`. Corrigido com `import 'dotenv/config';` como
     primeiríssima linha de `main.ts` — mesmo padrão já usado em
     `scripts/test-integration.js` e `prisma/seed.ts`.
  - Ambos validados rodando os dois servidores de verdade (`npm run dev`
    em `apps/api` e `apps/web`) e dirigindo os dois fluxos principais
    (síndico→dashboard→chamado, condômino→saldo→reserva) num navegador
    real — capturas de tela conferidas manualmente, não só os testes
    automatizados.

## Decisões de escopo de documentos, avisos e dashboard da administradora no frontend (Prompt 10.6)
- Único endpoint novo de backend deste prompt (o resto reaproveita as
  APIs já testadas dos Prompts 6, 7 e 8, por instrução explícita):
  `PATCH /avisos/:avisoId/marcar-lido` (`AvisosController`/
  `AvisosService.marcarComoLido`). Mesmo padrão "minha conta" de
  `GET /usuarios/me/avisos` (sem `@Roles`, sem `tenantPrisma`) — busca a
  `AvisoLeitura` pela chave composta exata `[avisoId, usuarioId]`
  (`@@unique` do model) e responde 404 se não existir. Como essa linha só
  existe pra um usuário que já foi resolvido como destinatário legítimo
  no momento da criação do aviso (dentro do `tenantPrisma` da rota de
  criação), a igualdade dupla é estritamente mais restritiva que qualquer
  filtro físico de tenant possível — cobre "aviso de outro usuário",
  "aviso de outro tenant" e "avisoId inexistente" com o mesmo 404, sem
  precisar de um novo branch em `tenant-scope-resolver.service.ts`.
  Validado pelo tenant-security-reviewer (nenhum CRÍTICO/AVISO).
- `/documentos`: sem endpoint de "listar unidades do condomínio" em
  nenhum prompt anterior (só existe `GET /unidades/:unidadeId`,
  unidade-a-unidade) — fora do escopo deste prompt criar um (instrução
  explícita de não tocar backend além do item acima). Não se aplica a
  documentos diretamente, mas é a mesma razão pela qual o formulário de
  aviso (abaixo) usa um campo de texto livre pro ID da unidade.
- Upload em `/documentos` faz `PUT` direto pro `uploadUrl` assinado
  (fetch puro, fora do `apiFetch` — é uma URL do R2, não da API, não leva
  `Authorization`). O input `type="file"` não tem `required`: a validação
  de "selecionou um arquivo?" é feita em JS (`if (!arquivo) setErro(...)`)
  em vez de depender da validação nativa do HTML5, porque o suporte de
  `required` em `input[type=file]` é inconsistente entre o que
  `userEvent.upload` consegue simular em jsdom e o comportamento real de
  navegador — preferimos uma validação que se comporta igual nos dois
  ambientes.
- Em dev, `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` no
  `.env` ainda são os placeholders do `.env.example` (nenhuma conta R2
  real configurada nesta máquina) — o presign em si (`gerarUrlUpload`) é
  cálculo local da SDK e funciona mesmo com credenciais falsas, mas o
  `PUT` real pro host resultante falha (DNS não resolve um account id
  fictício). Verificado manualmente que esse caminho falha de forma
  controlada (mensagem de erro na tela, sem crash) — a cobertura real do
  fluxo de upload completo (presign → PUT → arquivo acessível) é o teste
  de componente (`documentos-content.test.tsx`, mockando a chamada de
  rede) e o `documentos.integration-spec.ts` já existente (com
  `FakeR2Client`), nunca uma chamada de rede real nesta base.
- `/avisos`: o formulário de criação (SINDICO/ADMINISTRADORA) usa um
  campo de texto livre pro ID da unidade quando o escopo é "unidade
  específica", em vez de um seletor — não existe endpoint de listagem de
  unidades de um condomínio (ver item acima) e criar um fugiria da
  instrução explícita de não adicionar backend novo além do
  `marcar-lido`. UX mais bruta que o ideal (cuid em vez de
  identificador/bloco-apto), documentado aqui como decisão deliberada,
  não como bug — revisar se um endpoint de listagem de unidades for
  criado por outro motivo no futuro.
- `/avisos` mostra o formulário de criação OU a lista de não lidos, nunca
  os dois ao mesmo tempo, decidido só pelo papel (`ADMINISTRADORA`/
  `SINDICO` → formulário; `CONDOMINO` → lista) — leitura literal do
  prompt ("Para SINDICO/ADMINISTRADORA: formulário... Para CONDOMINO:
  lista"), mesmo o SINDICO sendo também destinatário de avisos por regra
  de negócio (`resolverDestinatariosDoAviso`). Ele não vê a própria caixa
  de não lidos nesta tela — decisão de escopo do frontend, não do
  backend (`GET /usuarios/me/avisos` continua retornando os avisos dele
  normalmente, só não é chamado nesta tela quando o papel é
  SINDICO/ADMINISTRADORA).
- `AvisoForm` (`app/(app)/avisos/aviso-form.tsx`) é um componente
  separado de `AvisosContent`, só pra ficar testável isoladamente (mesmo
  motivo de `LoginForm` ser separado de `app/login/page.tsx` no Prompt
  10.5) — recebe `condominioId` por prop e um `onCriado` opcional, sem
  saber nada sobre papel/RBAC.
- `/administradora/dashboard`: novo helper `obterAdministradoraId` em
  `lib/auth.ts` (mesmo padrão de `obterCondominioId`, lê o primeiro
  vínculo do JWT com `administradoraId`). Link "Carteira" na barra
  lateral só aparece pra quem tem vínculo ADMINISTRADORA
  (`Sidebar` agora lê `obterVinculos()`/`temPapel` num `useEffect`, ao
  contrário dos outros 4 itens estáticos) — diferente da decisão do
  Prompt 10.5 de não filtrar os itens do menu por papel; aqui filtra,
  porque mostrar "Carteira" pra um SINDICO levaria a uma página que
  `RequireRole` imediatamente redireciona pra fora, sem nenhum benefício
  de "pelo menos vê que existe" (os outros 4 itens são compartilhados
  por todo papel autenticado, este é exclusivo de um único papel).
- As três telas verificadas manualmente contra o banco populado pelo
  seed do Prompt 10 (`npm run db:seed`), num navegador real: upload
  visível só pro síndico e ausente pro condômino em `/documentos`; aviso
  criado pelo síndico aparece na caixa de não lidos do condômino em
  `/avisos`, e "marcar como lido" remove da lista; link "Carteira" e
  `/administradora/dashboard` visíveis só pra administradora, com os
  totais agregados da carteira renderizados corretamente.

## Decisões de escopo das telas de vitrine (Prompt 10.7)
- `Perfil`, `Configurações do bot no WhatsApp` e `Relatórios` são telas
  puramente estáticas — sem nenhum hook de dados (`useEffect`/
  `apiFetch`), sem estado, sem formulário. Compartilham um único
  componente (`components/layout/preview-placeholder.tsx`,
  `PreviewPlaceholder`) que recebe `icone`/`titulo`/`descricao` — extraído
  porque as três páginas são literalmente o mesmo layout (ícone num
  círculo + título + frase + selo), ao contrário das outras telas do
  produto, que sempre diferem o suficiente pra não valer a pena uma
  abstração.
- O selo "Em breve" (`Badge variant="outline"`, `data-testid=
  "preview-em-breve"`) é o único elemento, além do texto da frase, que
  sinaliza "prévia" — deliberadamente não um banner de aviso/cor de
  alerta (isso pareceria erro), nem um ícone de "em construção" (clichê
  visual de site quebrado). Mesma paleta clara do resto do produto.
- Rotas escolhidas (`/perfil`, `/bot-whatsapp`, `/relatorios`) não
  aparecem no prompt literalmente — só os rótulos da navegação aparecem
  ("Perfil", "Configurações do bot no WhatsApp", "Relatórios"). Path
  curto e sem acento pra cada uma, seguindo o padrão já usado nas rotas
  existentes (`/dashboard`, `/reservas` etc.); o rótulo completo do
  prompt fica só no texto visível (label da navegação e `<h1>` da
  página), nunca no path.
- As três entradas aparecem pra qualquer papel autenticado, sem
  `RequireRole` — ao contrário do link "Carteira" do Prompt 10.6 (que é
  condicional, porque levaria a uma página que rejeita quem não é
  ADMINISTRADORA), aqui não existe nenhuma regra de negócio associada
  a papel: são vitrine de produto completo, não uma função real
  restrita. Renderizar incondicionalmente pra todo papel é coerente com
  a própria intenção do prompt ("a navegação lateral parece a de um
  produto completo").
- `data-testid` da navegação deixou de ser derivado de
  `item.label.toLowerCase()` (que pra "Configurações do bot no
  WhatsApp" geraria um id com espaços e acentos, ruim pra seletor de
  teste) e passou a ser um campo `testId` explícito por item
  (`components/layout/sidebar.tsx`) — sem mudança de comportamento pros
  itens antigos (`nav-dashboard`, `nav-reservas` etc. continuam iguais).
- Verificado manualmente contra o servidor de dev (síndico logado):
  nenhuma das três páginas faz nenhuma requisição pra
  `http://localhost:3001` (API), confirmado interceptando os eventos de
  `request` do Playwright durante a navegação — garante que a
  instrução "sem nenhuma chamada de API" não regrida silenciosamente se
  alguém futuramente "completar" uma dessas telas sem atualizar este
  documento.

## Correção da rota raiz `/` (pós-Prompt 10.7)
`app/page.tsx` (raiz, fora do grupo `(app)`) nunca tinha sido tocado
desde o scaffold do Prompt 0 — continuava mostrando "Condly — em
construção" mesmo depois de `/login` e todo o resto existir, porque os
Prompts 10.5–10.7 só criaram rotas novas, nenhum removeu/redirecionou a
home. Corrigido pra um componente client que decide em `useEffect`:
sem `accessToken`, redireciona pra `/login`; com token, redireciona pra
`rotaInicialParaVinculos(obterVinculos())` (mesma função já usada pelo
`LoginForm`) — então administradora/síndico caem em `/dashboard` e
condômino em `/minha-unidade`, sem nunca mostrar o placeholder antigo.
Verificado manualmente com Playwright nos três casos (sem login,
administradora logada, condômino logado).

## Repaginação visual do frontend (pós-Prompt 10.7)
Pedido explícito do usuário: estilizar a casca e as telas pra parecer
"um produto completo, com UI bonita, nada revolucionário, mas que
impressione e pareça tecnológico" — dentro da identidade visual já
fixada (claro, sem dark mode, verde `#0F6E56`). Mudança só visual,
nenhum comportamento/contrato de API alterado; todos os `data-testid`
existentes foram preservados e os testes (15 no total) continuam
passando sem alteração de asserção.
- `globals.css`: o verde da marca deixou de viver só no wordmark e
  passou a ser `--primary` real do tema (`--brand: #0f6e56`,
  `--brand-strong: #0b5443` pra texto sobre fundo claro tingido) — todo
  botão padrão, anel de foco (`--ring`), badge "ativo" e estado
  selecionado usa a mesma cor, em vez do preto neutro padrão do
  shadcn. `--background` passou de branco puro pra um cinza muito claro
  (`oklch(0.97 ...)`), criando profundidade: sidebar e cards (que
  continuam brancos) "flutuam" sobre o canvas em vez de tudo ficar no
  mesmo tom. `--radius` aumentou de `0.625rem` pra `0.75rem` (cantos um
  pouco mais arredondados, leitura mais "produto moderno"). `Card`
  ganhou uma sombra sutil (`shadow-[...]`, dois-tons, suave) além do
  `ring` que já tinha — é a mudança que dá a sensação de elevação em
  toda tela do produto de uma vez, sem precisar tocar em cada página.
- `Wordmark` ganhou uma marca (rounded square com ícone `Building2` em
  fundo `bg-primary`) além do texto — vira o cabeçalho da própria
  Sidebar agora (antes vivia na Topbar, repetido em todo lugar que a
  usava). Prop `tamanho` (`'sm' | 'lg'`) substitui o controle antigo via
  `className="text-2xl"` (que não tinha efeito sobre o tamanho da nova
  marca-ícone).
- `Sidebar`: ganhou ícone por item (`lucide-react`, já era dependência
  do projeto desde o scaffold, nunca usada até agora), separação visual
  entre o grupo principal e o grupo de vitrine (rótulo "EM BREVE" em
  uppercase), e um indicador de item ativo com barra verde à esquerda +
  fundo tingido (`--sidebar-accent`) — span absoluto com opacidade
  condicional, não troca de layout entre estados ativo/inativo (evita
  "pulo" de conteúdo). Item "Carteira" continua condicional só pra
  ADMINISTRADORA (regra de negócio inalterada, ver decisão do Prompt
  10.6); os 3 itens de vitrine continuam sempre visíveis pra qualquer
  papel (regra do Prompt 10.7 também inalterada).
- `Topbar`: não mostra mais o wordmark (mudou pra Sidebar) — agora é só
  contexto da sessão: badge do papel principal do usuário logado (novo
  helper `papelPrincipal(vinculos)` em `lib/auth.ts`, mesmo padrão UX-
  only dos outros helpers ali, já que o JWT não traz nome/e-mail) e o
  botão "Sair" com ícone. `sticky top-0` com leve blur (`backdrop-blur-
  sm` + fundo translúcido) pra continuar visível ao rolar uma lista
  longa.
- Novo `components/layout/page-header.tsx` (`PageHeader`): ícone num
  círculo tingido + título + descrição opcional, substitui os `<h1>`
  soltos que cada página tinha. Usado pelas 6 páginas "reais"
  (`/dashboard`, `/minha-unidade`, `/reservas`, `/documentos`,
  `/avisos`, `/administradora/dashboard`) — as 3 páginas de vitrine
  (Prompt 10.7) deliberadamente NÃO usam `PageHeader`: antes da
  repaginação elas já duplicavam o título (um `<h1>` solto E o `título`
  dentro do próprio `PreviewPlaceholder`); a correção foi remover o
  `<h1>` duplicado e deixar o `PreviewPlaceholder`, agora maior e
  centralizado verticalmente (`min-h-[70vh]`), ser o único elemento da
  página — reforça visualmente que aquela tela é "diferente" (uma
  prévia), não mais uma página funcional com um header padrão.
- Novo `components/layout/stat-card.tsx` (`StatCard`): ícone + label +
  valor em destaque (fonte mono, a mesma já configurada em
  `--font-mono`/Geist Mono desde o scaffold, nunca usada até agora) —
  reusado pelos dois dashboards (`dashboard-content.tsx` e
  `administradora-dashboard-content.tsx`) pros números de "a receber",
  "recebido" e "chamados abertos na carteira". Números financeiros e
  contagens em monospace foi a escolha deliberada pra reforçar a leitura
  "técnica/dashboard de dados" pedida.
- `PreviewPlaceholder` ganhou borda tracejada (reforça "é uma prévia
  proposital", não site quebrado) e o selo "Em breve" ganhou um ícone
  `Sparkles` — único ajuste visual, a API do componente (props
  `icone`/`titulo`/`descricao`, testids `preview-placeholder`/
  `preview-em-breve`) não mudou, então o teste de componente já
  existente (`preview-placeholder.test.tsx`) continua passando sem
  alteração.
- `aviso-form.tsx`: checkboxes de canal e radios de escopo deixaram de
  ser inputs nativos visíveis e passaram a ser "chips" — o input nativo
  continua no DOM (classe `sr-only`, nunca `display:none`, pra
  `userEvent.click`/`.type` continuarem funcionando exatamente como
  antes) com um `<span>` irmão estilizado via `peer-checked:` refletindo
  o estado. Mesmos `data-testid`s nos próprios `<input>`s
  (`aviso-canal-app` etc.) — o teste de componente
  (`aviso-form.test.tsx`) não precisou de nenhuma alteração.
- `documentos-content.tsx`: zona de upload virou uma caixa tracejada
  (mesma linguagem visual do "preview" usado nas telas de vitrine, aqui
  significando "solte/escolha um arquivo aqui") com o botão nativo do
  input estilizado via `file:` (Tailwind) — sem trocar o `<input
  type="file">` por um componente de drag-and-drop de verdade
  (`nada revolucionário`); cada documento da lista ganhou um ícone de
  arquivo num círculo tingido, mesma linguagem visual do resto.
- Login (`app/login/page.tsx`): fundo com dois "blobs" radiais verdes
  bem sutis (`blur-3xl`, baixa opacidade) atrás do card central — único
  toque "decorativo" de toda a repaginação, mantido discreto de
  propósito (`nada revolucionário`). `LoginForm` ganhou ícones
  (`Mail`/`Lock`) dentro dos campos e `LogIn` no botão — mesmos
  `data-testid`s, `login-form.test.tsx` não precisou de alteração.
- Validação: `tsc --noEmit`, `next lint` e os 15 testes de componente
  (Vitest) continuam passando sem nenhuma alteração de asserção — só
  classe/estrutura de apresentação mudou. Conferido visualmente com
  Playwright contra o servidor de dev, logado como cada um dos 3 papéis
  (síndico, condômino, administradora), cobrindo as 9 telas
  autenticadas + a tela de login, sem nenhum erro de runtime
  (`page.on('pageerror')` vazio em todas).

## Importação de design escuro via Claude Design (pós-repaginação visual)
Pedido explícito do usuário: importar o design concept "Condly App.dc.html"
(projeto "Condly PWA para condomínios" no Claude Design, lido via tool
`DesignSync`/`get_file`) e aplicá-lo "exatamente como especificado",
preservando toda lógica/chamadas de API das páginas já existentes (login,
dashboard, minha-unidade, reservas, documentos, avisos, carteira).

**Decisão deliberada que reverte a identidade visual anterior**: o design
importado é inteiramente em tema escuro (`#0B0D11` fundo de página, `#14181F`
cards, texto `#E6E9EF`, verde `#1FB389`→`#0E7F60` em gradiente). Isso
contradiz a decisão "claro fixo, sem dark mode" registrada nas seções
anteriores deste arquivo (repaginação visual pós-Prompt 10.7 e decisões de
frontend do Prompt 10.5). Apresentei o conflito ao usuário antes de tocar em
qualquer código; a resposta explícita foi adotar o tema escuro do design,
substituindo (não complementando) a paleta clara — **não existe alternância
clara/escuro**, é uma troca de paleta única, mesmo espírito de "tema fixo" de
antes, só invertido. Toda menção a "claro fixo"/"sem dark mode" nas seções
anteriores deste arquivo está desatualizada por esta decisão; não removi o
texto histórico (documenta por que o código tinha aquela forma até aqui), mas
o estado atual do produto é escuro fixo.

**Cobertura do design importado, e o que foi extrapolado**: o arquivo
`.dc.html` é um protótipo interativo cuja IA de sidebar (Dashboard,
Financeiro, Moradores, Reservas, Manutenção, Comunicados, Assembleias,
Portaria, Relatórios) não corresponde 1:1 às páginas reais do produto. Só
Dashboard e Reservas têm telas de fato desenhadas no arquivo — Financeiro,
Moradores e Manutenção (Kanban) não existem no produto real (sem backend
correspondente) e foram ignoradas; Documentos, Comunicados, Assembleias,
Portaria e Relatórios aparecem todos como o MESMO placeholder genérico no
design ("Módulo planejado para a próxima etapa"), e login/minha-unidade/
avisos/carteira não aparecem em nenhuma tela do arquivo. Decisão confirmada
com o usuário: aplicar a linguagem visual do design 1:1 nas duas páginas que
ele de fato cobre (dashboard do síndico, reservas), e estender a mesma
linguagem (cores, tipografia, padrão de card/badge/ícone) por conta própria
nas páginas que o design não desenhou (login, minha-unidade, documentos,
avisos, carteira da administradora, telas de vitrine) — nenhuma tela ficou
sem retrabalho, mas só duas seguem o mockup literal porque só duas tinham
mockup.
- `globals.css`: tokens recriados em hexadecimal/rgba (abandonado o
  `oklch`/`color-mix` em espaço oklch da paleta clara anterior — mais simples
  manter a paleta escura literal do design do que recalcular em oklch).
  `--brand`/`--brand-strong`/`--brand-foreground` agora são o verde do
  design (`#1FB389`/`#0E7F60`/`#06120E`, este último o texto escuro usado
  sobre o gradiente verde nos botões primários, não branco). `--radius`
  subiu pra `0.875rem`. Removida a classe `.dark` inteira (não há mais
  alternância — o tema escuro é o único `:root`); a diretiva
  `@custom-variant dark` foi mantida (inofensiva, só não é mais alcançada
  por nenhuma troca de classe) pra não quebrar utilitários `dark:` ainda
  presentes nos primitivos shadcn gerados.
- Tipografia trocada de Geist (fonte local, `next/font/local`) pra Plus
  Jakarta Sans + Space Grotesk (Google Fonts, ambas via `next/font/google`
  — self-hosted em build, sem chamada de rede em runtime, importante pro
  PWA funcionar offline) — exigência literal do design (`helmet` do
  `.dc.html` carregava as duas via Google Fonts CDN). Novo token
  `--font-display` (Space Grotesk) substitui o uso de `--font-mono`/Geist
  Mono pra números em destaque (`StatCard`, saldo do condômino, ranking da
  administradora, contagem de chamados) — o design usa Space Grotesk pros
  números-chave, não uma fonte monoespaçada; todo `font-mono` desses
  contextos foi trocado pra `font-display`. `--font-mono` deixou de ser
  mapeado em `@theme inline` (nenhum uso restante).
- `Card` perdeu o `ring` + sombra em tom escuro-sobre-claro da repaginação
  anterior (`rgba(15,23,42,...)`, pensada pra fundo branco) e ganhou
  `border border-border` (a cor de borda agora é só `rgba(255,255,255,.08)`,
  igual ao design) + sombra recalculada em preto (`rgba(0,0,0,...)`, dá
  profundidade sobre fundo escuro em vez de sobre fundo claro).
- `Button` variant `default` ganhou o tratamento exato do design pro CTA
  primário: gradiente `from-brand to-brand-strong`, texto `font-semibold`
  cor `--brand-foreground` (escuro, não branco) e `shadow-[...]` verde —
  antes era um simples `bg-primary` sólido.
- `Wordmark`: ícone trocado de `Building2` pra `Home` (mais perto do
  glifo de "casa" usado no `.dc.html`), fundo do ícone virou gradiente
  (`from-brand to-brand-strong`) com sombra verde, e o texto "ly" deixou de
  ser colorido separadamente — no design o wordmark é uma cor só
  (`#E6E9EF`), a marca/distinção fica inteira no ícone.
- `Sidebar`: grupo principal ganhou rótulo "PRINCIPAL" (antes só o grupo de
  vitrine tinha rótulo) — agora os dois grupos seguem o mesmo padrão visual
  do design (rótulo uppercase, `tracking` largo, cor apagada). Indicador de
  item ativo trocado de uma barra absoluta posicionada em `inset-y` (gambiarra
  de antes pra evitar "pulo" de layout) pra `shadow-[inset_3px_0_0_var(--brand)]`
  (inset box-shadow não afeta layout, então o problema que a barra absoluta
  resolvia nem existe mais com essa técnica) — efeito visual idêntico ao
  "barra verde + fundo tingido" do design.
- `lib/status-labels.ts`: `COR_STATUS_CHAMADO`/`COR_STATUS_COBRANCA`
  recriados — eram pílulas claras (`bg-amber-100 text-amber-800
  border-amber-200`, pensadas pra fundo branco) e ficariam ilegíveis/
  destoantes sobre fundo escuro; agora são translúcidas sobre o fundo escuro
  (`bg-amber-500/15 text-amber-400 border-amber-500/30`), mesmo padrão de
  pílula de status usado no design (cor saturada de texto + fundo do mesmo
  tom em baixa opacidade). Novo export `PONTO_STATUS_CHAMADO` (cor sólida,
  só pro indicador/bolinha ao lado de cada chamado na listagem do
  dashboard — uma pílula translúcida fica invisível num elemento de 8px).
  Toda cor hardcoded assumindo fundo claro (`text-emerald-700`,
  `text-emerald-600`, `bg-white/70`, `bg-white/80`) foi trocada pro
  equivalente em tom claro-sobre-escuro (`text-emerald-400`, `bg-card/70`,
  `bg-background/80`).
- `reservas-content.tsx`: lista de horários do dia reestilizada pro padrão
  "ícone num círculo tingido + label + pílula/botão" igual à seção
  "Disponibilidade hoje" do design (antes era uma linha de texto simples com
  badge). O resto da página (formulário com `<select>` nativo de área comum
  e `<input type="date">` nativo) foi mantido sem alteração estrutural — ver
  decisão já registrada acima (Prompt 10.5) sobre por que esses dois campos
  são nativos, não um calendário customizado: a justificativa (Playwright
  dirige um `<select>`/`<input type="date">` nativo trivialmente) continua
  válida mesmo com o design tendo uma grade de calendário completa; replicar
  a grade exigiria abandonar essa decisão sem necessidade.
- `dashboard-content.tsx`: os 3 stat cards (a receber, recebido, unidades
  inadimplentes) e a lista de chamados foram reestilizados pro padrão exato
  do design (label uppercase pequeno + ícone tingido no topo do card, valor
  grande em `font-display` abaixo — card de chamado com bolinha de status à
  esquerda) **sem inventar dado nenhum**: o design mostra badges de
  tendência (`▲ 4,2%` etc.) e um gráfico de receitas/despesas que dependem
  de série histórica/categorização que a API não expõe — foram
  deliberadamente omitidos em vez de fabricados, porque mostrar uma
  tendência ou categoria de despesa que não vem de dado real violaria a
  instrução do próprio usuário de preservar a lógica/dados existentes.
- `StatCard` ganhou prop opcional `descricao` (subtexto abaixo do valor,
  mudança aditiva, nenhum call site existente quebrou) e o layout interno
  mudou de "ícone à esquerda, texto à direita" pra "label+ícone no topo,
  valor grande abaixo" — mesma composição do design.
- Páginas não cobertas pelo design (`minha-unidade`, `documentos`, `avisos`
  + `aviso-form`, `administradora-dashboard-content`, as 3 telas de
  vitrine) não precisaram de reescrita estrutural: já usavam só tokens
  semânticos (`bg-primary`, `text-muted-foreground`, `border-border` etc.)
  da repaginação anterior, então herdaram a paleta escura automaticamente
  ao trocar `globals.css` — só as cores hardcoded listadas acima (emerald/
  white) precisaram de ajuste manual.
- Validação: os 15 testes de componente (Vitest), `tsc --noEmit` e
  `next lint` continuam passando sem nenhuma alteração de asserção — só
  classe/estrutura de apresentação mudou, nenhum `data-testid` foi
  removido/renomeado. Conferido visualmente com Playwright contra um
  servidor de dev novo (porta livre, sem derrubar os servidores que o
  usuário já tinha rodando), logado como cada um dos 3 papéis, cobrindo
  login + as 9 telas autenticadas, sem erro de runtime. Confirmação
  incidental durante a verificação: `/reservas` é deliberadamente
  `RequireRole roles={['CONDOMINO']}` (decisão já registrada no Prompt
  10.5) — testar essa rota logado como síndico redireciona pro dashboard
  por design, não é regressão desta mudança.

## Correções de acesso do perfil ADMINISTRADORA (pós-importação de design)
Problema: todas as telas por-condomínio (`/dashboard`, `/reservas`,
`/documentos`, `/avisos`) mostravam mensagem de "usuário não vinculado
a condomínio" para ADMINISTRADORA, pois o JWT dela só carrega
`administradoraId` (sem `condominioId`) — diferente de SINDICO e
CONDOMINO. `/reservas` redirecionava pro dashboard por ter `RequireRole
roles={['CONDOMINO']}` exclusivo.

**Mudanças realizadas:**
- Novo endpoint de backend `GET /administradoras/:administradoraId/condominios`
  (`AdministradorasController`) — retorna `{ id, nome }` de todos os
  condomínios da carteira. Protegido por `@Roles('ADMINISTRADORA')` +
  `@CurrentTenantPrisma()` + `where: { administradoraId }` explícito (dupla
  camada). Auditado pelo `checar-isolamento-tenant`: nenhuma violação.
- `rotaInicialParaVinculos` (`lib/auth.ts`): ADMINISTRADORA agora rota para
  `/administradora/dashboard` (antes caía em `/dashboard` junto com SINDICO).
- `/dashboard` `RequireRole` mudou para `['SINDICO']` apenas — ADMINISTRADORA
  já tem `/administradora/dashboard`, não precisa acessar o dashboard por
  condomínio.
- Sidebar: item "Dashboard" é ocultado para ADMINISTRADORA (ela usa
  "Carteira" que aponta para `/administradora/dashboard`).
- Novo hook `useCondominioAtivo` (`lib/hooks/use-condominio-ativo.ts`):
  resolve `condominioId` para qualquer papel. Para SINDICO/CONDOMINO: lê
  diretamente dos vínculos do JWT. Para ADMINISTRADORA: chama o novo
  endpoint e pré-seleciona o primeiro condomínio; expõe a lista completa
  para um `CondominioSelector` (select nativo, mesmo padrão do seletor de
  área comum no Prompt 10.5).
- `/reservas` `RequireRole` mudou para `['CONDOMINO', 'SINDICO',
  'ADMINISTRADORA']`.
- `ReservasContent`, `DocumentosContent`, `AvisosContent`: todos reescritos
  para usar `useCondominioAtivo()` em vez de ler vínculos diretamente.
  Cada um exibe `CondominioSelector` quando `condominios.length > 1`
  (ADMINISTRADORA com múltiplos condomínios na carteira).
- Para AvisosContent: CONDOMINO continua vendo a lista de não lidos
  (`GET /usuarios/me/avisos`, sem condominioId). ADMINISTRADORA/SINDICO
  veem o formulário de criação com seletor de condomínio acima.
- Validação: lint limpo, `tsc --noEmit` sem erros nos dois apps.

## Dashboard multi-papel e expansão do seed (pós-correções de acesso ADM)
- `/dashboard` agora aceita `['SINDICO', 'ADMINISTRADORA']`. Um `DashboardRouter`
  client-side (`dashboard/dashboard-router.tsx`) decide qual componente renderizar:
  ADMINISTRADORA → `AdministradoraDashboardContent` (portfólio completo);
  SINDICO → `DashboardContent` (financeiro + chamados do condomínio).
- `rotaInicialParaVinculos` em `lib/auth.ts`: ADMINISTRADORA e SINDICO ambos
  caem em `/dashboard` (não mais `/administradora/dashboard`).
- Sidebar: "Dashboard" agora aparece para todos os papéis (filtro anterior que
  ocultava para ADMINISTRADORA removido). "Carteira" continua condicional só
  para ADMINISTRADORA — é uma segunda visão de portfólio, não substituta do
  Dashboard.
- `AdministradoraDashboardContent` (em `administradora/dashboard/`) contém o
  portfólio rico (KPIs, ranking arrecadação, faixas inadimplência, renovações,
  NPS mock, balanço mock) — mesmo componente, agora acessado via `/dashboard`.
- `CarteiraContent` (`carteira-content.tsx`) — novo componente simples que lista
  os condomínios com arrecadação e inadimplência básicas; renderizado pela
  página Carteira (`/administradora/dashboard`).
- **Seed expandido para 10 condomínios** (antes 1), todos vinculados à única
  administradora, com dados variados de adimplência (62%–100%), chamados
  distribuídos e serviços periódicos a vencer nos próximos 30 dias. Usuários
  de demo (administradora, síndico, 3 condôminos) continuam vinculados ao
  primeiro condomínio (Residencial Ipê Verde). Os outros 9 condomínios não têm
  usuários de demo, mas têm cobranças, chamados e serviços reais pra popular
  o dashboard da administradora.

## Decisões de escopo de dados complementares de unidade (DadosUnidade)
- Novo model `DadosUnidade` (1:1 com `Unidade`, `unidadeId @unique`, `onDelete: Cascade`)
  com 11 campos booleanos, `statusOcupacao` (String enum: PROPRIETARIO/INQUILINO/VAZIA),
  `veiculos` (Json array: `[{ placa, modelo, cor }]`) e 4 campos opcionais de texto — todos
  opcionais (`@default(false)` nos booleanos), preenchidos sob demanda.
- Entra em `UNIDADE_ID_MODELS` de `tenant-prisma.ts` (tem `unidadeId` direto, mesmo padrão de
  `Cobranca`/`Reserva`). Para scope `unidadeId`: `{ unidadeId: scope.unidadeId }`. Para scope
  `condominioId`-only: `{ unidade: { condominioId: ... } }`. Para `administradoraId`-only:
  `{ unidade: { condominio: { administradoraId: ... } } }`.
- **Regra inegociável** (CLAUDE.md "Outras regras de domínio"): campos sensíveis só podem
  ser lidos por SINDICO e ADMINISTRADORA. Por isso os dois endpoints são `@Roles('ADMINISTRADORA',
  'SINDICO')` — não há rota "minha conta" para CONDOMINO ler/escrever estes dados diretamente.
  Se um endpoint de auto-preenchimento pelo condômino for criado futuramente, exige nova análise
  de segurança (quais campos são sensíveis, como proteger de leitura cruzada).
- `GET /unidades/:unidadeId/dados` e `PUT /unidades/:unidadeId/dados` resolvem o scope pelo
  `unidadeId` já existente em `TenantScopeResolverService` — sem branch novo. O `salvar` faz
  `upsert` (cria se não existe, atualiza se já existe) — idempotente, sem 404 em primeira chamada.
- Vínculo com chamados: frontend (`chamados-content.tsx`) mostra um painel "Dados da unidade"
  (lazy-load, expansível via botão "Ver dados") para gestores que expandem um chamado com
  `unidadeId`. CONDOMINO nunca vê este painel — o botão só renderiza se `ehGestor` é true.
  O `chamados.service.ts` passou a incluir `unidade: { select: { id, identificador } }` (antes
  era só `identificador`) para o frontend poder chamar o endpoint de dados com o id real.
- Vínculo com perfil: `perfil-content.tsx` (`AbaUnidades`) ganhou expansão por unidade com
  `FormDadosUnidade` — cada item da lista de unidades tem um botão de expansão que carrega e
  permite editar os dados complementares daquela unidade via `GET/PUT /unidades/:id/dados`.
- Auditoria de segurança pós-implementação (tenant-security-reviewer): nenhum CRÍTICO. Achados:
  - **AVISO** (aceito): `DadosUnidadeService.buscar` retorna `null` em vez de 404 quando a
    unidade ainda não tem perfil preenchido — não é falha de isolamento (o filtro do
    `tenantPrisma` já garante que a query só enxerga a unidade autorizada), só diferença de
    contrato de API. Comportamento intencional: o frontend distingue `null` (sem dados) de erro.
  - **AVISO** (aceito): o bloco `create` do `upsert` em `salvar` não recebe o filtro de tenant
    do `tenant-prisma.ts` (mesmo padrão já documentado para outros services com `upsert`) — o
    `unidadeId` no `create` já foi validado na linha anterior via `tenantPrisma.unidade.findUnique`
    (que está sob filtro), então não há exploração possível.
  - **SUGESTÃO** (aberta): nenhum teste de integração cobre os dois novos endpoints —
    falta cenário de CONDOMINO recebendo 403, de SINDICO de tenant diferente sendo bloqueado,
    e de idempotência do upsert. O isolamento está correto no código; a lacuna é de cobertura.
  - **SUGESTÃO** (aberta): `abrePorAdm` em `ChamadosService.abrirChamado` usa
    `usuario.vinculos.some((v) => v.papel === 'ADMINISTRADORA')` sem checar `administradoraId`
    — mesmo code smell já aceito e documentado para `abrePorSindico` na mesma função; não é
    exploitável pelo mesmo motivo (o `RolesGuard` já garante o vínculo antes do service).

## Decisões de escopo do módulo assembleias
- Novos models `Assembleia` (condominioId direto → entra em `CONDOMINIO_ID_MODELS`),
  `PautaAssembleia` e `AssembleiaDocumento` (sem condominioId próprio, mesmo padrão
  de `OpcaoEnquete`/`AvisoLeitura` — isolamento garantido pela validação do pai via
  `tenantPrisma` antes de operar nos filhos via `this.prisma` com filtro duplo
  `{ id, assembleiaId }`).
- Status: `AGENDADA → REALIZADA | CANCELADA`. Só `AGENDADA` pode ser excluída
  (`DELETE`). `CANCELADA` não pode ser editada. `REALIZADA` pode receber novos
  documentos e ter deliberações atualizadas mas não muda de status — decisão deliberada
  (uma assembleia realizada é um registro imutável de evento, não um draft).
- "Registrar resultados" (`PATCH /assembleias/:id` com `status: REALIZADA` + `pautas`
  com deliberações + `linkGravacao`) é uma operação única — o SINDICO/ADM faz tudo de
  uma vez ao fechar a assembleia, não em múltiplos PATCHs separados. O endpoint
  aceita atualizações parciais de qualquer campo também (para editar data/local de
  uma assembleia AGENDADA antes de ela acontecer).
- Documentos da assembleia são referências manuais (título + URL opcional), não
  integram com o módulo de documentos do R2 — mantém a tela de Assembleias
  independente do fluxo de upload e não exige credenciais R2 para funcionar.
  Revisar se um endpoint de "vincular documento existente" for pedido futuramente.
- `GET /condominios/:condominioId/assembleias` retorna lista completa com pautas e
  documentos incluídos (um único `findMany` com `include`) — CONDOMINO precisa ver
  deliberações sem precisar de um GET por assembleia, então a resposta é rica desde a
  listagem. Quantidade de assembleias por condomínio é baixa (1–2 por ano), então
  não há problema de payload.
- Acessível a todos os papéis autenticados (`ADMINISTRADORA`, `SINDICO`, `CONDOMINO`)
  para leitura. Mutações (criar, editar, excluir, cancelar, adicionar/remover
  documentos) exigem `ADMINISTRADORA` ou `SINDICO` — CONDOMINO é sempre somente
  leitura. Ênfase nas deliberações é deliberada e documentada: é comum que moradores
  não presentes contestem decisões; ter um registro datado e assinado pela
  assembleia resolve isso.
- Auditoria de segurança pós-implementação (tenant-security-reviewer): nenhum
  CRÍTICO/AVISO. SUGESTÃO aberta: `remover` valida via `tenantPrisma` e depois
  deleta via `this.prisma.$transaction` sem atomicidade entre as duas etapas — em
  cenário de deleção concorrente pode gerar 500 do Prisma em vez de 404 controlado.
  Mesma limitação já aceita em `ReservasService.cancelar`.

## Seed expandido (usuários por condomínio) + condomínio na topbar
Pedido do usuário: (1) mostrar o condomínio associado quando SINDICO/
CONDOMINO logam; (2) 1 síndico por condomínio e ~10 condôminos por
condomínio pra testes; (3) semear enquetes, avisos e todo dado possível
pra visualizar as features.
- Topbar (`components/layout/topbar.tsx`): busca `GET /condominios/:id`
  (endpoint já aberto aos 3 papéis) usando `obterCondominioId` dos
  vínculos do JWT e mostra o nome ao lado do badge de papel
  (`data-testid="topbar-condominio"`). ADMINISTRADORA não tem
  `condominioId` no vínculo, então o badge não aparece pra ela — por
  design (ela tem carteira, não UM condomínio).
- `prisma/seed.ts`: cada condomínio agora tem 1 síndico
  (`sindico{N}.demo@condly.app`, N=2..10; o 1º continua
  `sindico.demo@condly.app`) e até 10 condôminos
  (`condomino{J}.demo@condly.app` no 1º condomínio,
  `condomino{J}.c{N}.demo@condly.app` nos demais), vinculados às
  unidades 101 em diante — 109 usuários no total, os 5 logins originais
  inalterados. Telefones WhatsApp únicos e sequenciais (regra de
  identidade do bot). Chamados passaram a ser abertos pelo síndico do
  próprio condomínio (2 deles por condôminos do 1º condomínio); aviso
  geral com leituras pra todos os destinatários em TODOS os condomínios;
  novos dados de demonstração: 5 enquetes (ATIVA/ENCERRADA/RASCUNHO, com
  votos), 3 assembleias (AGENDADA/REALIZADA com pautas, deliberações e
  documentos), 4 ações administrativas, 3 documentos (keys R2 fictícias
  — listagem funciona, download falha controlado, mesmo padrão do upload
  em dev) e `DadosUnidade` das unidades 101–103 do 1º condomínio.
- `distribuirStatusCobrancas` extraída como função pura exportada, e
  `contagensEsperadas()` exportada do seed computa TODAS as contagens a
  partir das mesmas configs — `verify-seed-counts.ts` consome isso e
  nunca mais precisa de recontagem manual (estava desatualizado desde a
  expansão pra 10 condomínios e ninguém percebeu).
- `test/helpers/cleanup-database.ts` não apagava Enquete/OpcaoEnquete/
  VotoEnquete/Assembleia/PautaAssembleia/AssembleiaDocumento/
  AcaoAdministrativa — quebraria o seed na 2ª execução por FK assim que
  essas tabelas tivessem dados. Corrigido (deleteMany na ordem de FK).
- Specs de integração atualizados pra contratos que já tinham mudado em
  sessões anteriores sem atualizar os testes (12 falhas pré-existentes,
  nenhuma causada por esta sessão): `titulo` obrigatório + `categoria`
  enum em chamados; ADMINISTRADORA abre chamado como ABERTO
  (`abrePorAdm`); CONDOMINO lê o próprio condomínio (200) mas nunca o de
  outro tenant (403 — teste novo); `areas-comuns` retorna
  `regrasReserva`. Também corrigido `documentos-content.test.tsx` (web),
  que ainda mockava o fluxo antigo de upload por signed URL em vez do
  `POST /documentos/upload` multipart atual.
- Validação: 112/112 testes de integração, 15/15 testes de componente,
  tsc e lint limpos nos dois apps; seed rodado 2x no dev (idempotência) +
  smoke test; fluxo da topbar exercitado contra a API real com
  condômino, síndico novo e condômino de outro condomínio.

## Correção do service worker do PWA (cache-first congelava dados da API)
Sintoma reportado: condômino criava um chamado, o síndico via, mas a
listagem do próprio condômino não atualizava. Causa raiz: o `sw.js` do
scaffold PWA (Prompt 0) fazia **cache-first de todo GET**, inclusive das
chamadas autenticadas à API — a primeira resposta de cada URL ficava
congelada no Cache Storage e todo refetch subsequente era servido dela
(o backend estava correto o tempo todo: via curl/node, que não passam
pelo service worker, POST→GET imediato sempre refletia o dado novo; só
o navegador via a lista velha). Agravante de segurança: a chave do cache
é só a URL (`Authorization` não participa), então trocar de usuário no
mesmo navegador podia servir a resposta cacheada do usuário anterior —
ex. um condômino recebendo a lista completa de chamados cacheada por um
síndico do mesmo condomínio.
- Correção em `public/sw.js` (v2): requisições de outra origem (a API)
  não são mais interceptadas — passam direto pra rede, sempre. Same-origin
  (shell/assets) mudou de cache-first pra network-first com fallback no
  cache (offline continua funcionando, sem servir asset velho com rede
  disponível). `skipWaiting` + `clients.claim` + bump de `CACHE_NAME`
  pra `condly-cache-v2` fazem o SW novo assumir e expurgar o cache
  envenenado da v1 sem exigir que o usuário limpe nada manualmente.
- Diagnóstico digno de nota pra debugging futuro: o bug NÃO reproduzia
  via curl/node (sem SW) nem parecia cache HTTP (headers sem
  Cache-Control); `page.route('**')` do Playwright também não desligava
  o comportamento (fetches do service worker não passam pelo route do
  Playwright). O padrão revelador foi "carga de página sempre fresca,
  refetch pós-criação sempre idêntico à resposta anterior".
- Se um dia o PWA precisar de cache offline de DADOS da API, isso exige
  design próprio (chave por usuário, invalidação por mutação, TTL) —
  nunca voltar o fetch handler genérico do sw.js pra cima da API.

## Navegação mobile (drawer) — correção de PWA
Sintoma reportado: em viewport mobile (emulação de device), a Sidebar some
(`hidden md:flex`) e não existia NENHUMA navegação alternativa — as outras
telas ficavam inacessíveis.
- O conteúdo da navegação (grupos, itens, filtro por papel) foi extraído de
  `Sidebar` pra um componente exportado `ConteudoNavegacao` em
  `components/layout/sidebar.tsx`, compartilhado entre a sidebar desktop e o
  novo drawer mobile — os itens nunca divergem entre os dois. `ItemLink`
  ganhou `onClick` opcional (o drawer passa pra se fechar ao navegar).
- Novo `components/layout/mobile-nav.tsx` (`MobileNav`): botão hambúrguer
  (`md:hidden`, `data-testid="botao-menu-mobile"`) renderizado na Topbar +
  drawer lateral (painel `w-72`, mesmo visual da sidebar) com backdrop.
  Fecha ao navegar (efeito sobre `pathname`), ao clicar fora, no botão X e
  com Escape; trava o scroll do fundo enquanto aberto. Implementação própria
  com Tailwind (sem `Sheet` do shadcn) — mesmo espírito da decisão do
  `<select>` nativo do Prompt 10.5: menos partes móveis e trivial de dirigir
  em teste.
- **Pegadinha que custou uma iteração**: o drawer é renderizado via
  `createPortal(document.body)` porque a Topbar tem `backdrop-blur`, e
  `backdrop-filter` cria containing block — um `position: fixed` descendente
  fica confinado à caixa do header (o overlay só cobria a altura da topbar e
  o `<main>` interceptava os cliques no backdrop). Se algum outro overlay
  `fixed` for criado dentro da Topbar no futuro, precisa do mesmo portal.
- Topbar deixou de ser `justify-end`: hambúrguer à esquerda, resto num
  wrapper `ml-auto`; nome do condomínio ganhou `truncate` limitado a 40vw no
  mobile pra não estourar a largura.
- Verificado com Playwright em 390×844 (síndico): sidebar oculta, hambúrguer
  visível, sem scroll horizontal, drawer abre com os 14 itens do papel,
  navegar pra /avisos fecha o drawer, backdrop e Escape fecham; em 1280×800
  a sidebar volta e o hambúrguer some. 15/15 testes de componente, tsc e
  lint limpos.

## Responsividade mobile + PWA instalável
Pedido do usuário: telas "coladas na direita"/estourando no mobile, e
deixar o app pronto pra instalar como PWA.
- **Causa raiz do overflow (vale pra qualquer tela futura)**: a coluna de
  conteúdo do layout autenticado (`app/(app)/layout.tsx`) é um flex item, e
  flex item tem `min-width: auto` — qualquer elemento com `white-space:
  nowrap` (o que inclui TODA classe `truncate` e o `Badge` do shadcn)
  propaga sua largura mínima intrínseca até a raiz e estica a página
  inteira além da viewport; o `truncate` nunca chega a agir. Corrigido com
  `min-w-0` na coluna (`div.flex.min-w-0.flex-1.flex-col`). Diagnóstico
  feito com auditoria Playwright em 390px medindo
  `scrollWidth - clientWidth` por página/papel + bisseção do DOM
  (esconder elementos até o overflow zerar) — o script é descartável, mas
  a técnica fica registrada aqui.
- Fixes pontuais restantes: Topbar (nome do condomínio é o único item que
  encolhe/trunca; badge e Sair são `shrink-0`); `main` com `p-4 sm:p-6
  md:p-8`; formulário de assembleias (grid `grid-cols-1 sm:grid-cols-2` +
  `min-w-0` nos inputs — input de data/hora tem min-width intrínseco
  grande); cabeçalho do card de assembleia (`flex-wrap` — a fileira de
  botões de ação quebra pra baixo em telas estreitas); item da lista de
  documentos (`flex-wrap`). Auditoria final: 0px de overflow nas 25
  combinações página/papel testadas em 390×844.
- **PWA instalável**: `public/icons/icon.svg` refeito com a marca real do
  produto (gradiente `#1FB389→#0E7F60` + glifo Home do lucide, mesmo
  visual do `Wordmark`) — o anterior era resto do scaffold (caixa cinza
  com "C"). Gerados `icon-192.png`/`icon-512.png` (cantos transparentes,
  purpose `any`), `icon-maskable-512.png` (full-bleed, glifo na zona
  segura de 80%, purpose `maskable`) e `apple-touch-icon.png` (180px,
  opaco — iOS não lê o manifest, exige o `<link rel="apple-touch-icon">`).
  Os PNGs foram renderizados a partir do SVG com o próprio Chromium
  (screenshot) — se o SVG mudar, regenerar do mesmo jeito, não editar os
  PNGs à mão. `manifest.json` atualizado (cores do tema escuro `#0b0d11`,
  `scope`, `orientation: portrait`, os 4 ícones); `layout.tsx` ganhou
  `appleWebApp` (capable/title/statusBarStyle) e `viewport` explícito
  (`device-width`, `initialScale: 1`, `viewportFit: cover`). Verificado
  em navegador real: manifest linkado, 4 ícones respondendo 200,
  `apple-mobile-web-app-capable`, theme-color e service worker ativo —
  os critérios de instalabilidade do Chrome (manifest completo + PNG
  192/512 + SW com fetch handler) todos presentes.

## Perfil de gestão do SINDICO (paridade com a ADMINISTRADORA no próprio condomínio)
Pedido do usuário: o /perfil do síndico deve ser como o da ADM, só que
restrito ao condomínio dele, com as mesmas visualizações e ações.
- Backend — RBAC expandido (o RolesGuard já restringe SINDICO ao próprio
  condomínio em todas estas rotas, então liberar o papel não abre tenant):
  - `PATCH /condominios/:id`: + SINDICO, **mas `permissoesSindico` só pode
    ser alterada por um vínculo ADMINISTRADORA da administradora DESTE
    condomínio** (checagem em `CondominiosService.atualizar` contra
    `cond.administradoraId`) — senão o síndico desbloquearia as próprias
    restrições. Não basta ter "algum" vínculo ADMINISTRADORA: o caso de
    papel duplo (síndico daqui + administradora de OUTRA carteira) foi
    encontrado pela skill checar-isolamento-tenant na primeira versão desta
    mudança (que checava só o papel) e corrigido antes de concluir — teste
    nomeado em `condominios-gestao.integration-spec.ts`.
  - Membros (`GET/POST/DELETE /condominios/:id/membros...`): + SINDICO.
    `adicionarMembro` não recebe mais a administradoraId do vínculo do
    autor — deriva de `cond.administradoraId` (síndico não tem
    administradoraId própria; e o valor correto é o da administradora do
    condomínio, nunca a do autor).
  - Unidades (`POST/PATCH/DELETE`): + SINDICO.
  - Continuam exclusivos da ADM: criar condomínio, excluir condomínio e
    editar permissoesSindico.
- **Bug pré-existente corrigido, achado pelo teste novo**:
  `listarMembros` filtrava só `vinculoUsuario.condominioId`, mas vínculo de
  CONDOMINO normalmente só carrega `unidadeId` (seed, login) — a lista de
  membros da ADM já vinha SEM nenhum condômino do seed. Corrigido com
  `OR: [{ condominioId }, { unidade: { condominioId } }]` (os dois ramos
  pinados ao mesmo condominioId da rota).
- Frontend: `/perfil` (`RequireRole` agora ADMINISTRADORA+SINDICO — estava
  ADM-only e redirecionava o síndico pro dashboard) renderiza pro síndico o
  MESMO `CardCondominioCompleto` da ADM (dados, permissões, membros,
  unidades, dados complementares), só do condomínio dele, via nova prop
  `ehAdministradora` que esconde: botão de excluir condomínio, toggles de
  permissão no modo edição (visão read-only das permissões continua — útil
  pro síndico saber o que pode) e o envio de `permissoesSindico` no PATCH.
  Sem `administradoraId`, o root `PerfilContent` resolve o condomínio do
  vínculo SINDICO e carrega via `GET /condominios/:id`. CONDOMINO vê
  mensagem informativa (antes via "conta não vinculada a uma
  administradora", enganoso).
- Novo spec `condominios-gestao.integration-spec.ts` (13 testes): PATCH
  cadastral pelo síndico, bloqueio de permissoesSindico (síndico puro e
  papel duplo), cross-tenant 403 em PATCH/membros/unidades, condômino 403,
  fluxo completo de membro (add com herança de administradoraId + remove) e
  de unidade (cria + exclui), DELETE de condomínio negado pro síndico.
- Validação: 126/126 testes de integração, 15/15 de componente, tsc/lint
  limpos nos dois apps; fluxo real no navegador como síndico (editar
  telefone, listar/adicionar/remover membro, criar/excluir unidade, sem
  toggles de permissão na edição) + persistência conferida via API.

## Bot do WhatsApp v2 — menu completo do CONDOMINO (fluxos multi-turno)
Expansão do módulo bot (Prompt 9) pra cobrir o menu completo pedido pelo
usuário, implementado primeiro pro papel CONDOMINO. As regras inegociáveis
do módulo continuam TODAS de pé: identidade exclusivamente do
`telefoneWhatsapp`, denylist antes de qualquer palavra-chave, motor de
regras (não LLM), assinatura HMAC validada antes de qualquer payload.
- **Menu numerado** (`bot/menu.ts`, contrato com `OPCAO_MENU` e o switch do
  BotService): 1 financeiro da unidade, 2 resultados de assembleias,
  3 reservar área comum, 4 abrir chamado, 5 meus chamados, 6 última
  advertência, 7 ações administrativas, 8 últimos avisos, 9 2ª via de
  boleto. Saudações ("oi", "menu"...) apresentam o menu; número solto 1-9
  escolhe a opção; palavras-chave também funcionam.
- **Fluxos multi-turno** (novo campo `ConversaBot.fluxo Json?`, migração
  `20260709103534_bot_fluxos_condomino`; shape em `bot/fluxos/tipos.ts`,
  expira em 30min de inatividade; NUNCA é fonte de autoridade):
  - Reserva (`fluxos/fluxo-reserva.service.ts`): área (lista numerada, ou
    "reservar salão" pula direto) → dia ("hoje"/"amanhã"/DD/MM) → horários
    livres reais fatiados pela duração mínima (máx. 12 slots) →
    confirmação. A criação delega pra `ReservasService.criar` (exportado de
    `ReservasModule` pra isso) com um `AuthenticatedUser` CONDOMINO montado
    da identidade — MESMAS regras da API (conflito com corrida coberta,
    antecedência, horário de funcionamento, unidade própria), nunca
    reimplementadas. A disponibilidade também vem de
    `ReservasService.disponibilidade`. `TenantPrismaClient` é alias de tipo
    de `PrismaService`, então o client cru passa direto (padrão do módulo:
    isolamento pela identidade, não pelo filtro físico).
  - Chamado (`fluxos/fluxo-chamado.service.ts`): pede a descrição → cria
    `PENDENTE_TRIAGEM` (mesmo status de CONDOMINO no app), categoria OUTRO
    fixa (bot não classifica; triagem do síndico ajusta). Texto vira só
    titulo/descricao — dado inerte.
  - Comandos globais valem dentro de fluxo: *cancelar* encerra, *menu*
    volta; denylist roda ANTES do fluxo (frase de manipulação nunca vira
    "descrição de chamado" — teste dedicado).
- **Consultas** (todas pinadas à identidade): financeiro é DA UNIDADE
  (a pagar/em atraso/pago no ano/saldo devedor/próximo vencimento) — totais
  do condomínio são SINDICO/ADM-only por regra de domínio, a versão pra
  esses papéis fica pra próxima etapa; assembleias = até 2 REALIZADAS com
  deliberações + próxima AGENDADA; meus chamados = mesma visibilidade de
  CONDOMINO da API (abertos por ele OU da unidade); advertência = só da
  própria unidade; ações administrativas = 3 últimas do condomínio;
  avisos = gerais + direcionados à própria unidade (nunca de outra);
  boleto = placeholder deliberado ("em implantação") a pedido do usuário,
  MAS envia o `linkPagamento` real se a cobrança tiver um.
- `reconhecerIntencao` reescrito (tipos novos; `SALDO`→`FINANCEIRO`,
  `CHAMADO`→`ABRIR_CHAMado`/`MEUS_CHAMADOS`); denylist intocado e agora
  também exportado como `ehTextoSuspeito` pro BotService usar em fluxos.
  Pegadinhas registradas: "ª" não decompõe pra "a" em NFD (regex de boleto
  lista `[ªa]` literal); `\b` em "acao"/"acoes" evita falso positivo com
  "reclamacao"/"informacao".
- **Semântica de erro do webhook**: exceção ao GERAR resposta → resposta
  neutra ao usuário (nunca 500); falha ao ENVIAR via Cloud API → logada
  (sem o texto) e o webhook responde 200 mesmo assim — um 500 faria a Meta
  reenviar o payload e REPROCESSAR a mensagem (ex: chamado duplicado). Em
  dev sem credenciais reais da Meta, o envio falha de propósito e é só
  logado.
- Validação: 135/135 testes de integração (spec do bot reescrito — fluxo
  de reserva completo criando Reserva real, chamado criado com triagem,
  negativos de tenant pra área/assembleia/ação/aviso/advertência,
  manipulação no meio de fluxo) + 43 unitários; conversa completa dirigida
  ao vivo contra o dev server via webhook assinado (telefone do
  condomino1 do seed): as 10 interações responderam certo e a reserva foi
  criada no banco. Skill checar-isolamento-tenant: nenhuma violação (o
  único `findUnique` sem pin — areaComumId vindo do estado do fluxo — é
  seguro por construção, estado só escrito pelo bot, e revalidado na
  escrita pelo ReservasService).
- **SUGESTÃO** (aberta): o webhook não deduplica por `message.id` (wamid) —
  se a Meta reenviar o mesmo evento (timeout de rede), a mensagem é
  processada de novo. Mitigado pelo 200-mesmo-com-falha-de-envio acima;
  dedup por wamid fica como melhoria futura.
- **Próxima etapa combinada**: versões do bot pra SINDICO/ADMINISTRADORA
  (financeiro do condomínio inteiro etc.) e ação concreta de 2ª via quando
  o módulo de boletos existir.

## Definição de "pronto"
Uma tarefa só está concluída quando: os testes relevantes passam,
não há erro de tipo, o lint está limpo, e — se a mudança tocou em
Cobranca, Condominio ou qualquer query multi-tenant — a skill
checar-isolamento-tenant foi executada sobre o diff.
