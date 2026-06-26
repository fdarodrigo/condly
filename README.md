# Condly

SaaS de gestão condominial multi-tenant. Monorepo com dois apps:

- `apps/web` — frontend Next.js 14 (App Router), TypeScript, Tailwind CSS v4 e
  shadcn/ui, configurado como PWA.
- `apps/api` — backend NestJS, TypeScript e Prisma ORM, conectado a um
  PostgreSQL via `DATABASE_URL`.

Documentação completa em [`docs/arquitetura.md`](docs/arquitetura.md) e
[`docs/stack.md`](docs/stack.md). Regras de desenvolvimento assistido por IA
em [`CLAUDE.md`](CLAUDE.md).

## Pré-requisitos

- Node.js 20+
- Docker (para o PostgreSQL local — veja abaixo)

## Instalação

O monorepo usa npm workspaces — um único `npm install` na raiz resolve as
dependências dos dois apps:

```bash
npm install
```

## Banco de dados (PostgreSQL via Docker)

O `docker-compose.yml` na raiz sobe um Postgres dedicado ao Condly na porta
`5433` (evita conflito com qualquer Postgres que você já tenha rodando na
5432), com dois bancos: `condly_dev` (desenvolvimento) e `condly_test`
(testes de integração, criado automaticamente por
`docker/postgres-init/01-create-test-db.sql`).

```bash
docker compose up -d
```

## Variáveis de ambiente

### apps/api

Copie o exemplo (já configurado para o Postgres do Docker acima):

```bash
cp apps/api/.env.example apps/api/.env
```

Variáveis:
- `DATABASE_URL` — string de conexão do Postgres de desenvolvimento (`condly_dev`).
- `TEST_DATABASE_URL` — string de conexão do Postgres de teste (`condly_test`),
  usada só por `npm run test:integration`. Nunca deve apontar para o mesmo
  banco do `DATABASE_URL`.
- `PORT` — porta do backend (padrão `3001`, separada da porta do frontend).
- `JWT_SECRET` — segredo de assinatura dos tokens de autenticação. Troque o
  valor de exemplo antes de qualquer deploy real.
- `JWT_EXPIRES_IN` — validade do token (padrão `1h`).
- `ASAAS_API_URL` — `https://api-sandbox.asaas.com/v3` em dev/teste,
  `https://api.asaas.com/v3` só em produção.
- `ASAAS_API_KEY` — API Key da sua conta Asaas (sandbox ou produção, de
  acordo com `ASAAS_API_URL`). Veja como obter a de sandbox abaixo.
- `ASAAS_WEBHOOK_TOKEN` — token que você mesmo escolhe e configura também
  no painel do Asaas ao criar o webhook; precisa ser idêntico nos dois
  lados. O Asaas reenvia esse valor no header `asaas-access-token` em toda
  notificação, e é assim (não HMAC) que validamos que a chamada é legítima.
- `ASAAS_ENV` — `sandbox` (padrão) ou `production`. Em produção,
  `FinanceiroService` recusa criar cobrança pra uma `Unidade` sem
  `responsavelCpfCnpj` cadastrado (ver seção abaixo), em vez de deixar o
  Asaas falhar na criação do cliente.

Depois de configurar o `.env`, gere o client do Prisma e aplique as
migrations:

```bash
cd apps/api
npx prisma generate
npx prisma migrate dev
```

### apps/web

Não há variáveis obrigatórias ainda neste esqueleto inicial.

## Rodando localmente

Em dois terminais separados:

```bash
# terminal 1 — backend (http://localhost:3001)
cd apps/api
npm run dev

# terminal 2 — frontend (http://localhost:3000)
cd apps/web
npm run dev
```

Verifique o backend em `http://localhost:3001/health` — deve responder
`{"status":"ok"}`. O frontend mostra "Condly — em construção" em
`http://localhost:3000`.

## Gateway de pagamento (Asaas sandbox)

O módulo financeiro (`apps/api/src/financeiro`) integra com o
[Asaas](https://www.asaas.com) para gerar boleto/PIX e receber confirmação de
pagamento via webhook. Para testar contra o ambiente sandbox (gratuito, sem
dados reais):

1. Crie uma conta em **https://sandbox.asaas.com** (é um ambiente totalmente
   separado da conta de produção — não precisa de CNPJ real para começar a
   testar).
2. No painel, vá em **Integrações → API** e copie a **API Key** de sandbox.
   Cole em `ASAAS_API_KEY` no `.env` de `apps/api`.
3. Ainda no painel, vá em **Integrações → Webhooks** e crie um novo webhook:
   - URL: o endereço público do seu backend + `/webhooks/asaas` (em dev local
     isso exige um tunnel como `ngrok` ou `cloudflared`, já que o Asaas
     precisa alcançar sua máquina pela internet).
   - Eventos: pelo menos `PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`.
   - Token de autenticação: escolha um valor forte e copie o mesmo valor para
     `ASAAS_WEBHOOK_TOKEN` no `.env`. O Asaas reenvia esse token no header
     `asaas-access-token` em toda chamada — é assim que `POST /webhooks/asaas`
     valida que a notificação é legítima, **antes** de tocar em qualquer
     dado (ver `AsaasWebhookController`).
4. Para simular o pagamento de uma cobrança criada em sandbox, abra a
   cobrança no painel do Asaas e use a opção de confirmar/simular o
   recebimento — isso dispara o webhook real para a URL configurada.

**Cadastro do responsável (CPF/CNPJ):** o Asaas exige um *customer*
cadastrado para emitir cobrança, e a API de produção exige CPF/CNPJ desse
cliente. `Unidade` tem os campos opcionais `responsavelNome`,
`responsavelEmail` e `responsavelCpfCnpj` — quando preenchidos,
`AsaasHttpClient` cria/atualiza o cliente no Asaas com esses dados. Sem
`responsavelCpfCnpj`:
- em `ASAAS_ENV=sandbox` (padrão), a cobrança é criada normalmente (o Asaas
  sandbox aceita cliente sem CPF/CNPJ) e um aviso é logado;
- em `ASAAS_ENV=production`, `POST /condominios/:id/cobrancas` retorna
  `422` de forma tratada, sem chamar o gateway nem criar registro local.

Ainda não existe endpoint para cadastrar esses dados pela API — por ora,
isso é feito direto no banco (ou via seed). Uma tela/endpoint de cadastro
de morador é trabalho de um prompt futuro.

Os testes de integração (`npm run test:integration`) **não** chamam o Asaas
real — usam um `FakeAsaasClient` injetado via `overrideProvider`, então
rodam sem rede e sem credenciais. O fluxo manual acima é só para validar a
integração de ponta a ponta contra o sandbox de verdade.

## Testes (apps/api)

```bash
npm run test:unit         # Jest sem tocar banco
npm run test:integration  # aplica as migrations no banco de teste e roda os testes de integração
```

`test:integration` lê `TEST_DATABASE_URL` do `.env`, aplica
`prisma migrate deploy` nesse banco e só então roda os specs
`*.integration-spec.ts` em `apps/api/test/`.

## Lint, tipos e formatação

```bash
# em cada app
npm run lint
npx tsc --noEmit

# formatação compartilhada (Prettier), a partir da raiz
npm run format        # aplica
npm run format:check  # só verifica
```
