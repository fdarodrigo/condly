# Tech stack and implementation plan — Condly

## 1. Recommended stack overview

| Layer | Recommended technology | Why |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS + shadcn/ui, as a PWA | A responsive web app works on desktop (building manager/management company) and on mobile (resident) without publishing to an app store |
| Backend | Node.js with NestJS + Prisma ORM | Organized structure, strong typing, easy to hire developers for in Brazil |
| Database | PostgreSQL (via Supabase or Neon) | Relational, robust for financial data, supports Row-Level Security for multi-tenant isolation |
| Hosting (MVP) | Vercel (frontend) + Railway or Render (backend) | Fast deploys, low initial cost |
| File storage | Cloudflare R2 (S3-compatible) | Low cost for condominium documents and photos |
| Transactional email | Resend | Simple API, free up to a reasonable volume |
| Payment gateway | Asaas or Efí, through a sub-account per condominium | Boleto + PIX with automatic confirmation webhook, no transaction cost for Condly |
| WhatsApp bot | Meta WhatsApp Cloud API (official) | See section 3 |

## 2. Frontend: PWA, web and mobile from one codebase

A PWA is used normally in the browser (covering building managers and management companies) and can be "installed" on the resident's phone home screen, receiving push notifications like a native app: one codebase covering both ends. Moving to a native app published in the stores is a later decision, possible without a rewrite (tools such as Capacitor package the same PWA), if it proves necessary for commercial credibility.

## 3. WhatsApp bot: API choice and architecture

### 3.1 Options available in Brazil

| Option | Advantage | Risk |
|---|---|---|
| Meta WhatsApp Cloud API (direct) | Cheapest per message, full control | Business verification is more bureaucratic at first |
| Brazilian BSP (Zenvia, Take Blip, Gupshup) | Faster onboarding, support in Portuguese | Higher cost per message, third-party dependency |
| Unofficial solutions | Immediate setup | High risk of the number being banned; not recommended |

**Recommendation**: Meta WhatsApp Cloud API directly, starting the business verification process (Meta Business Manager) as early as possible, in parallel with development.

### 3.2 Bot architecture: rules, not free-form generative AI, in v1

A bot based on **menus and structured intents**, not an AI agent with full freedom to answer. In a product that touches money and condominium data, predictability matters more than natural conversation. Simple natural-language processing on top of the rules is viable and improves the experience without giving up control.

### 3.3 Scope of the bot's information and actions (v1)

**The bot resolves on its own**: check outstanding balance and next due date; send a duplicate boleto/PIX; check ticket status; check common area availability; make a booking (if there is no conflict); confirm an announcement was read.

**The bot starts, a human finishes**: open a ticket (the building manager classifies it); report an incident (reviewed before closing); request a document (secure link, not the file over chat); cancel a booking (double confirmation).

**Out of scope in v1**: editing sensitive registration data; accessing another resident's profile; taking part in formal voting; negotiating a delinquency agreement.

### 3.4 Example conversation flow (common area booking)

```
Resident: Hi, I'd like to book the party hall
Bot: Hello! For which date would you like to book the party hall?
Resident: August 15
Bot: The hall is available on 08/15. Confirm the booking from 2 pm to 10 pm?
     [Confirm] [Choose another time]
Resident: [Confirm]
Bot: Booking confirmed! You can see the details at: [app link].
```

(The real bot converses in Portuguese.)

## 4. Payment gateway: sub-account model

Each condominium (with its own CNPJ) has its own sub-account in Asaas or Efí. The money goes straight into the condominium's account; the per-transaction fee is deducted from it, not from Condly. Both gateways offer a free test environment (sandbox) and allow real low-value charges (R$1 to R$5) in production to validate the flow end to end before charging any real resident.

**Question to validate with the partner**: does the management company already use its own billing system? If so, running both in parallel at first is recommended: the pilot condominiums keep the current process active while the next charges are generated through Condly, with no need to migrate history.

## 5. Demo strategy: real backend, not a mock

Build the real backend from the start, with test data (seed), instead of a mocked frontend: the bot's differentiator cannot be demonstrated convincingly with static screens.

### Suggested test script

1. Create a fictitious condominium with 15 to 20 units, some charges paid, some overdue.
2. Create the three test logins: management company, building manager and two or three residents.
3. Connect a WhatsApp Cloud API number in sandbox mode.
4. Demo script: financial dashboard with delinquency → balance check over WhatsApp → common area booking through the bot → confirmation showing up automatically on the app calendar.

## 6. Cost and development timeline estimate

With the simplified branding model (no dynamic theming engine, no custom domain per client), the MVP scope became lighter than the initial estimate:

| Approach | Estimated timeline | Estimated cost |
|---|---|---|
| Freelancer, 1 full-stack dev | 9 to 12 weeks | R$32,000 to 48,000 |
| Small squad (back + front) | 7 to 9 weeks | R$55,000 to 80,000 |
| Agency | 10 to 14 weeks | R$80,000 to 145,000 |

Recommendation: start with an experienced full-stack freelancer in Node.js/React, or a pair working in parallel.

## 7. Testing strategy

Recommended test pyramid, from cheapest/fastest to most expensive/slowest:

1. **Unit tests**: isolated business rules (delinquency calculation, booking conflict validation, the bot's intent engine), without touching a real database. Tool: Jest (ships with NestJS). Script: `npm run test:unit`.
2. **Integration tests**: real endpoints hitting a real test database (not mocked). Essential for actually testing multi-tenant isolation, not just isolated logic. Use a separate database/schema (`condly_test`) or Testcontainers to spin up an ephemeral Postgres per run. Script: `npm run test:integration`.
3. **End-to-end (E2E) tests**: full browser flows covering each profile's critical paths. Tool: Playwright. Script: `npm run test:e2e`.

### What must be tested, in priority order

| Priority | What to test | Why |
|---|---|---|
| 1 | Multi-tenant isolation in every module | The most expensive error in the system: a building manager of condominium A must never access data from condominium B |
| 2 | Payment webhook: idempotency and signature | A duplicated webhook must not create a duplicated payment; a payload without a valid signature must be rejected |
| 3 | RBAC per role | Each role (management company/building manager/resident) accesses only what the architecture defines |
| 4 | Ticket and Charge state machines | Invalid status transitions must not happen |
| 5 | Booking conflict | Two bookings cannot take the same time slot in the same common area |
| 6 | Bot intent engine | Each keyword leads to the right action; out-of-scope messages fall back, never "invent" an answer |

### Coverage target

A reasonable reference number is ~80% line coverage in the business modules of `apps/api/src` (billing, tickets, bookings, RBAC, bot). It is not a target to chase at any cost: testing trivial getters/setters or logic-free DTOs adds no real safety, it only inflates the number. Always prioritize the list in the table above over the coverage metric itself.

### Continuous integration

Set up a CI workflow (GitHub Actions) that runs lint, type checks, unit tests and integration tests on every push and pull request, blocking merges if anything fails (detailed in Prompt 11 of the prompts document).

## 8. Immediate technical next steps

1. Check with the partner whether the management company already has its own billing system.
2. Start the business verification process in Meta Business Manager for the WhatsApp Cloud API.
3. Create a test (sandbox) account in Asaas or Efí, and open test sub-accounts per fictitious condominium.
4. Define the fictitious demo condominium and its test data.
