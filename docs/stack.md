# Stack tecnológico — Condly

> Ver `docs/arquitetura.md` para o desenho do sistema. Este documento
> cobre só as escolhas de tecnologia e como cada peça está configurada.

## 1. Frontend (`apps/web`)

- **Next.js 14** (App Router), **TypeScript**, configurado como PWA.
- **Tailwind CSS v4** + **shadcn/ui** (`@base-ui/react`, `class-variance-authority`,
  `tailwind-merge`) para componentes.
- Ainda no esqueleto inicial — `npm run dev` sobe em `http://localhost:3000`,
  sem variáveis de ambiente obrigatórias até este ponto do projeto.

## 2. Backend (`apps/api`)

- **NestJS** (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) +
  **TypeScript**.
- **Prisma ORM** (`@prisma/client` 7.x, `@prisma/adapter-pg`) sobre
  **PostgreSQL**.
- Autenticação via **JWT** (`@nestjs/jwt`, `passport-jwt`), senha com
  **bcrypt**.
- Validação de entrada com **class-validator** / **class-transformer**,
  aplicado globalmente via `ValidationPipe({ whitelist: true, transform: true })`.
- Eventos de domínio com **`@nestjs/event-emitter`** (hoje só
  `chamado.status_alterado`, ver `docs/arquitetura.md` seção 5).
- Testes: **Jest** (`test:unit`, sem tocar banco) e specs de integração
  (`*.integration-spec.ts`, sobem o `AppModule` completo contra um banco
  Postgres real de teste via `supertest`).
- `npm run dev` sobe em `http://localhost:3001`; `GET /health` responde
  `{"status":"ok"}`.

## 3. Integrações externas

### 3.1 PostgreSQL

`docker-compose.yml` na raiz sobe um Postgres dedicado na porta `5433`
(evita conflito com qualquer instância já rodando na 5432 da máquina),
com dois bancos: `condly_dev` (desenvolvimento) e `condly_test`
(integração, criado automaticamente por
`docker/postgres-init/01-create-test-db.sql`). `TEST_DATABASE_URL` nunca
deve apontar para o mesmo banco de `DATABASE_URL`.

### 3.2 Asaas (gateway de pagamento)

Usado pelo módulo `financeiro` para emitir cobrança (boleto/PIX) e
receber confirmação de pagamento. Cada condomínio tem uma subconta no
Asaas (`Condominio.subcontaGatewayId`), usada via split no momento da
criação da cobrança.

- `ASAAS_API_URL`: `https://api-sandbox.asaas.com/v3` em dev/teste,
  `https://api.asaas.com/v3` só em produção.
- `ASAAS_ENV` (`sandbox` por padrão, ou `production`): em produção,
  `FinanceiroService` recusa criar cobrança para uma `Unidade` sem
  `responsavelCpfCnpj` cadastrado — falha tratada (`422`), sem chamar o
  gateway.
- Webhook (`POST /webhooks/asaas`): autenticado por um token estático
  (`ASAAS_WEBHOOK_TOKEN`) reenviado pelo Asaas no header
  `asaas-access-token` — **não é HMAC**, é comparação direta de token, e
  a validação acontece antes de qualquer leitura do payload. Nunca logar
  o payload completo de uma Cobranca ou de um webhook — só IDs e status.
- Testes de integração usam um `FakeAsaasClient` injetado via
  `overrideProvider(ASAAS_CLIENT)` — nunca tocam o Asaas real.

### 3.3 Bot de WhatsApp

> Citado por `CLAUDE.md` como a referência de escopo do bot — ainda não
> implementado como módulo de API (não existe controller/service de bot
> em `apps/api/src` neste momento). O que está fixado aqui é a decisão
> de produto que qualquer implementação futura precisa respeitar.

- Canal: **Meta WhatsApp Cloud API**.
- O bot é um **motor de regras**, não geração livre de texto. Ele pode
  responder com saldo, status de chamado, ou dados cadastrais **apenas**
  através de fluxos pré-definidos que buscam o dado exato no banco
  (sempre pelo `tenantPrisma` da seção 4 de `docs/arquitetura.md`,
  identificando o tenant pelo `telefoneWhatsapp` vinculado a uma
  `Unidade`/`Usuario`) — nunca deixando um LLM compor livremente uma
  frase com saldo, valor de cobrança ou dado de outro morador.
- `ConversaBot` (schema) já existe para registrar o histórico de
  mensagens por unidade (`unidadeId`, `mensagens: Json`), mas a
  integração com a Cloud API e o motor de regras em si são trabalho de
  um prompt futuro.

## 4. Ambiente local — resumo de comandos

Ver `README.md` na raiz para o passo a passo completo de setup. Os
comandos do dia a dia estão centralizados em `CLAUDE.md`.
