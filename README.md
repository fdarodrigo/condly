# Condly

Multi-tenant SaaS for condominium management in Brazil. Property management
companies (*administradoras*) subscribe to Condly and offer their
condominiums (building managers and residents) automated billing, support
tickets, common-area bookings, documents, announcements, polls, assembly
records and a WhatsApp bot.

Monorepo with two apps:

- `apps/web`: Next.js 14 (App Router), TypeScript, Tailwind CSS v4 and
  shadcn/ui, installable as a PWA.
- `apps/api`: NestJS, TypeScript and Prisma ORM on PostgreSQL.

Full documentation in [`docs/arquitetura.md`](docs/arquitetura.md)
(architecture) and [`docs/stack.md`](docs/stack.md) (stack and
implementation plan). Rules for AI-assisted development in
[`CLAUDE.md`](CLAUDE.md) and
[`docs/boas-praticas-ia.md`](docs/boas-praticas-ia.md).

> Domain entities and code comments are in Portuguese on purpose, mirroring
> the Brazilian business vocabulary (`Cobranca` = charge, `Chamado` = support
> ticket, `Unidade` = housing unit, `Condominio` = condominium). Generic code
> follows standard English Node/TypeScript conventions.

## Highlights

- **Multi-tenant isolation in two layers.** Every protected route resolves a
  tenant scope (management company, condominium or unit), an RBAC guard
  authorizes it, and a Prisma client extension injects the tenant filter
  into queries on tenant-owned models, so a forgotten `where` in a service
  does not leak another tenant's data.
- **Aggregations in the database, with a query budget.** The management
  company dashboard computes per-condominium collection and delinquency
  totals in a single hand-written SQL query (conditional aggregation over
  condominium → unit → charge), and a test asserts it always runs in 2
  queries whether the portfolio has 3 or 100 condominiums.
- **Payment and messaging webhooks.** The Asaas webhook is authenticated
  before any payload is read and is idempotent (a repeated notification
  never pays a charge twice). The WhatsApp webhook verifies an HMAC-SHA256
  signature over the raw body, and answers 200 even when sending the reply
  fails, so Meta does not redeliver and reprocess the message.
- **Rule-based WhatsApp bot with strict identity.** Who is talking comes only
  from the phone number, never from message text, with a prompt-manipulation
  denylist and multi-turn flows for bookings and tickets that reuse the same
  service rules as the HTTP API.
- **Tested against a real database.** 135 API integration tests run on
  PostgreSQL (no mocked ORM), plus 43 API unit tests and component tests for
  the web app. External services (Asaas, Cloudflare R2, Resend, Meta) are
  faked behind interfaces, so tests need no network or credentials.

## Prerequisites

- Node.js 20+
- Docker (for the local PostgreSQL, see below)

## Installation

The monorepo uses npm workspaces, so a single install at the root covers
both apps:

```bash
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required: there is a real peer dependency conflict
between the Angular devkit tools pulled in by `@nestjs/schematics` /
`@nestjs/cli` and the `rxjs` version required by other dependencies.
Without the flag, the default (strict) resolution fails. Use the same flag
when adding a dependency to either app, otherwise some peer dependency may
be left uninstalled (this happened with `@testing-library/dom` when setting
up Vitest in `apps/web`).

## Database (PostgreSQL via Docker)

`docker-compose.yml` starts a dedicated Postgres on port `5433` (to avoid
clashing with a Postgres you may already run on 5432) with two databases:
`condly_dev` (development) and `condly_test` (integration tests, created by
`docker/postgres-init/01-create-test-db.sql`).

```bash
docker compose up -d
```

## Environment variables

### apps/api

Copy the example, already configured for the Docker Postgres above:

```bash
cp apps/api/.env.example apps/api/.env
```

Variables:

- `DATABASE_URL`: development database connection string (`condly_dev`).
- `TEST_DATABASE_URL`: test database connection string (`condly_test`),
  used only by `npm run test:integration`. Must never point to the same
  database as `DATABASE_URL`.
- `PORT`: API port (default `3001`, separate from the frontend port).
- `JWT_SECRET`: signing secret for auth tokens. Replace the example value
  before any real deploy.
- `JWT_EXPIRES_IN`: token lifetime (default `1h`).
- `ASAAS_API_URL`: `https://api-sandbox.asaas.com/v3` for dev/test,
  `https://api.asaas.com/v3` only in production.
- `ASAAS_API_KEY`: API key of your Asaas account (sandbox or production,
  matching `ASAAS_API_URL`). See how to get a sandbox key below.
- `ASAAS_WEBHOOK_TOKEN`: a token you choose and also configure in the Asaas
  dashboard when creating the webhook; it must be identical on both sides.
  Asaas sends it in the `asaas-access-token` header of every notification,
  and that (not HMAC) is how the API checks the call is legitimate.
- `ASAAS_ENV`: `sandbox` (default) or `production`. In production the API
  refuses to create a charge for a unit without the payer's CPF/CNPJ (see
  below) instead of letting Asaas fail on customer creation.
- Cloudflare R2 (`R2_*`), Resend (`RESEND_*`) and WhatsApp Cloud API
  (`WHATSAPP_*`) credentials: documented inline in `.env.example`.

Then generate the Prisma client and apply the migrations:

```bash
cd apps/api
npx prisma generate
npx prisma migrate dev
```

### apps/web

```bash
cp apps/web/.env.example apps/web/.env.local
```

- `NEXT_PUBLIC_API_URL`: base URL of the API (default
  `http://localhost:3001`), reachable from the browser.

## Running locally

In two terminals:

```bash
# terminal 1: API (http://localhost:3001)
cd apps/api
npm run dev

# terminal 2: web app (http://localhost:3000)
cd apps/web
npm run dev
```

Check the API at `http://localhost:3001/health`, which should answer
`{"status":"ok"}`. Opening `http://localhost:3000` redirects to the login
page (or to the right home screen if you are already signed in).

## Demo data

`npm run db:seed` (in `apps/api`, reads `DATABASE_URL` and refuses to run
outside a `_dev`/`_test` database, see `validarBancoDeDesenvolvimento` in
`prisma/seed.ts`) creates a fixed demo scenario: 1 management company, 10
condominiums (174 units), 109 users (1 company admin, 1 building manager
per condominium and up to 10 residents per condominium), with charges,
bookings, tickets, announcements, polls, assemblies, administrative
actions, documents, warnings and extra unit data spread across them.
**It is destructive**: it wipes all domain tables before recreating the
scenario.

### Credentials

Password for every demo user: **`123`** (short emails on purpose: demo
environment, never real data).

| Role | Email | Linked to |
| --- | --- | --- |
| ADMINISTRADORA (company admin) | `adm@app.com` | "Administradora Demo", portfolio with all 10 condominiums |
| SINDICO (building manager) | `sind1@app.com` | "Residencial Ipê Verde" (1st in the list) |
| SINDICO | `sind{N}@app.com` (N = 2..10) | N-th condominium (e.g. `sind2` → Edifício Maracanã) |
| CONDOMINO (resident) | `cond{J}@app.com` (J = 1..10) | J-th unit of Residencial Ipê Verde (101, 102, 103, ...) |
| CONDOMINO | `cond{J}.c{N}@app.com` | J-th unit of the N-th condominium (e.g. `cond1.c2` → unit 101 of Edifício Maracanã) |

Condominium order (same as `CONDOMINIOS_CONFIG` in `prisma/seed.ts`):
1. Residencial Ipê Verde, 2. Edifício Maracanã, 3. Condomínio Solar das
Pedras, 4. Torres do Parque, 5. Villagio Toscana (8 units, so 8
residents), 6. Residencial Bela Vista, 7. Edifício Copacabana Club,
8. Condomínio Rio Branco, 9. Residencial Alegria, 10. Boulevard Jardins.

The main ones to try: `adm@app.com` (portfolio), `sind1@app.com` (manager
of the 1st condominium) and `cond1@app.com` (resident of unit 101).

### What each login shows

- **Company admin** (`/dashboard` and `/administradora/dashboard`): a
  10-condominium portfolio with varied collection rates (62% to 100%), 16
  open tickets, collection and delinquency rankings, and recurring services
  due in the next 30 days.
- **Manager of Ipê Verde** (`/dashboard`): monthly financial summary (9 paid,
  3 pending) and 3 tickets (1 ABERTO, 1 PENDENTE_TRIAGEM opened by the
  resident of 101, 1 RESOLVIDO opened by the resident of 102). In
  `/enquetes`, 3 polls (active with votes, closed with results, draft); in
  `/assembleias`, 1 scheduled (with notice) and 1 held (with resolutions,
  minutes and a recording link); in `/acoes-administrativas`, 3 actions; in
  `/documentos`, 3 documents (1 restricted to manager/admin); 2 warnings
  issued; extra data filled for units 101 to 103. The other 9 managers have
  similar, smaller scenarios.
- **Residents** (`/minha-unidade`): the first 3 of each condominium have a
  PENDENTE/ATRASADO charge (never in the paid block); everyone has at least
  1 unread announcement in `/avisos`; residents 1 to 3 have a confirmed
  future booking; in Ipê Verde, residents 1 to 6 and 1 to 8 have already
  voted in the active and closed polls and can see the partial results.

**Note on `/reservas`:** the screen defaults to "tomorrow", but seeded
bookings start 3 days after the seed runs, so on seed day the default view
may look fully available. Move the date forward (about 3 to 20 days) to see
booked slots.

## Payment gateway (Asaas sandbox)

The billing module (`apps/api/src/financeiro`) integrates with
[Asaas](https://www.asaas.com) to issue boleto/PIX charges and receive
payment confirmations by webhook. To test against the free sandbox:

1. Create an account at **https://sandbox.asaas.com** (fully separate from
   production; no real company registration needed to start testing).
2. In the dashboard, go to **Integrações → API** and copy the sandbox **API
   Key** into `ASAAS_API_KEY` in `apps/api/.env`.
3. Go to **Integrações → Webhooks** and create a webhook:
   - URL: your API's public address + `/webhooks/asaas` (locally this needs
     a tunnel such as `ngrok` or `cloudflared`, since Asaas must reach your
     machine over the internet).
   - Events: at least `PAYMENT_CONFIRMED` and `PAYMENT_RECEIVED`.
   - Auth token: choose a strong value and copy the same value into
     `ASAAS_WEBHOOK_TOKEN`. Asaas sends it in the `asaas-access-token`
     header of every call, and that is how `POST /webhooks/asaas` checks the
     notification is legitimate, **before** touching any data (see
     `AsaasWebhookController`).
4. To simulate a payment, open a sandbox charge in the Asaas dashboard and
   use the confirm/simulate payment option. That fires the real webhook to
   your configured URL.

**Payer registration (CPF/CNPJ):** Asaas needs a registered customer to
issue a charge, and the production API requires the customer's CPF/CNPJ.
`Unidade` has optional `responsavelNome`, `responsavelEmail` and
`responsavelCpfCnpj` fields; when present, `AsaasHttpClient` creates or
updates the Asaas customer with them. Without `responsavelCpfCnpj`:

- with `ASAAS_ENV=sandbox` (default), the charge is created normally (the
  sandbox accepts customers without CPF/CNPJ) and a warning is logged;
- with `ASAAS_ENV=production`, `POST /condominios/:id/cobrancas` returns a
  handled `422`, without calling the gateway or creating a local record.

Integration tests never call the real Asaas: they use a `FakeAsaasClient`
injected with `overrideProvider`, so they run without network or
credentials. The manual flow above is only for end-to-end validation
against the real sandbox.

## Tests (apps/api)

```bash
npm run test:unit         # Jest, no database
npm run test:integration  # applies migrations to the test database, then runs the integration specs
```

`test:integration` reads `TEST_DATABASE_URL` from `.env`, runs
`prisma migrate deploy` against that database and then runs the
`*.integration-spec.ts` specs in `apps/api/test/`.

## Lint, types and formatting

```bash
# in each app
npm run lint
npx tsc --noEmit

# shared formatting (Prettier), from the root
npm run format        # apply
npm run format:check  # check only
```

## Deploy

A zero-cost demo deploy (Neon + Render + Vercel) is described step by step
in [`docs/deploy.md`](docs/deploy.md).
