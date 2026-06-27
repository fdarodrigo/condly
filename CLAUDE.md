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
  teste (`TEST_DATABASE_URL`) e roda os specs `*.integration-spec.ts`
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

## Débito técnico conhecido (revisão de segurança pós-Prompt 3, reauditado pós-Prompt 4, pós-Prompt 7, pós-Prompt 8, pós-Prompt 9 e pós-Prompt 10.5)
Review do tenant-security-reviewer sobre schema + auth/RBAC + financeiro.
Reauditado retroativamente sobre toda a base (Prompts 1-4) após o
commit inicial, de novo sobre os módulos de chamados (visibilidade/
máquina de estados), reservas, documentos e avisos (commits `71415f7`
a `c40b4e8`), de novo sobre o módulo de dashboards (Prompt 8), de novo
sobre o módulo de bot do WhatsApp (Prompt 9, com foco extra na regra de
identidade exclusiva por `telefoneWhatsapp`), e de novo sobre os dois
endpoints novos que sustentam o frontend (`GET /unidades/me/saldo` e
`GET /condominios/:id/areas-comuns`, Prompt 10.5) — nenhum CRÍTICO
encontrado em nenhuma das rodadas. Itens abertos, não ignorar
silenciosamente:
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

## Definição de "pronto"
Uma tarefa só está concluída quando: os testes relevantes passam,
não há erro de tipo, o lint está limpo, e — se a mudança tocou em
Cobranca, Condominio ou qualquer query multi-tenant — a skill
checar-isolamento-tenant foi executada sobre o diff.
