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

## Débito técnico conhecido (revisão de segurança pós-Prompt 3, reauditado pós-Prompt 4 e pós-Prompt 7)
Review do tenant-security-reviewer sobre schema + auth/RBAC + financeiro.
Reauditado retroativamente sobre toda a base (Prompts 1-4) após o
commit inicial, e de novo sobre os módulos de chamados (visibilidade/
máquina de estados), reservas, documentos e avisos (commits `71415f7`
a `c40b4e8`) — nenhum CRÍTICO encontrado em nenhuma das rodadas. Itens
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
- Canal WHATSAPP só chama `WhatsappClient.enviarAvisoWhatsapp(aviso)` —
  stub deliberado (`WhatsappStubClient`) que não faz nada e nunca lança
  erro, seguindo o mesmo padrão de DI por interface dos outros clients
  externos (Asaas, R2). Implementação real (Meta WhatsApp Cloud API) entra
  no Prompt 9, só troca o provider em `AvisosModule`.
- Cada canal selecionado em `canais` dispara seu efeito de forma
  independente: sem EMAIL, nenhum e-mail é enviado mesmo que haja
  destinatários; sem APP, nenhuma `AvisoLeitura` é criada (o aviso nunca
  aparece em `GET /usuarios/me/avisos`, mesmo tendo sido enviado por
  EMAIL/WHATSAPP).

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
