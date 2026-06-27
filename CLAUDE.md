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

## Débito técnico conhecido (revisão de segurança pós-Prompt 3, reauditado pós-Prompt 4, pós-Prompt 7, pós-Prompt 8 e pós-Prompt 9)
Review do tenant-security-reviewer sobre schema + auth/RBAC + financeiro.
Reauditado retroativamente sobre toda a base (Prompts 1-4) após o
commit inicial, de novo sobre os módulos de chamados (visibilidade/
máquina de estados), reservas, documentos e avisos (commits `71415f7`
a `c40b4e8`), de novo sobre o módulo de dashboards (Prompt 8), e de novo
sobre o módulo de bot do WhatsApp (Prompt 9, com foco extra na regra de
identidade exclusiva por `telefoneWhatsapp`) — nenhum CRÍTICO encontrado
em nenhuma das rodadas. Itens abertos, não ignorar silenciosamente:
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
