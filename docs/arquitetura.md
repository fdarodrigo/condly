# System architecture — Condly

## 1. Overview

Condly is a multi-tenant condominium management platform sold to **property management companies** (*administradoras*), which enable modules per condominium within their portfolio. Three user profiles access the same system with different permissions:

- **Management company**: sees every condominium in its portfolio, configures modules, follows consolidated performance.
- **Building manager** (*síndico*): sees only the condominium(s) they manage; handles tickets, documents, finances and communication.
- **Resident** (*condômino*): sees only their own unit, uses the web app/PWA or talks to the WhatsApp bot.

The system has four layers: **application (web app/PWA)**, **central API**, **database** and **external integrations** (WhatsApp bot and payment gateway).

## 2. Multi-tenant model and branding

**Product decision**: Condly runs under its own brand, not as a full white label. The Condly name and visual identity are visible to management companies and residents. What exists is **light co-branding**: the management company's name and logo appear at specific touchpoints (the bot's welcome message, the email sender, an "offered by [Management company]" banner inside the app), without requiring a dynamic theming engine, a custom domain per client, or any per-tenant visual redesign of the product.

This follows a pattern already proven in the market: Gruvi, the resident app from Superlógica (the largest platform provider in the sector), runs under a single brand of its own and is used by residents of more than 100,000 condominiums run by different management companies. None of them needs to "dress" the app in their own brand for it to be adopted.

**Data isolation (this does not change)**: regardless of the branding decision, multi-tenant isolation remains a security and privacy requirement, not an aesthetic one. Recommendation for the MVP: **a single database, with logical isolation by `administradoraId`**. Every relevant table carries that column, and every backend query filters on it automatically (via middleware or PostgreSQL Row-Level Security).

Advantages of this simplification at the current stage:
- Engineering scope drops considerably: no logo upload, color palette customization or custom domain per client.
- The Condly brand accumulates reputation, reviews and use cases in one place, instead of being fragmented into per-company "instances".
- If the partnership with the first client does not move forward, the product is ready, with its own identity, to be offered to any other management company, with no visual reconfiguration work.

## 3. Main entities (simplified data model)

- **Administradora** (management company): registration data, subscribed plan.
- **Condomínio** (condominium): belongs to a management company; registration data, address, registered common areas, and the identifier of its sub-account in the payment gateway (see section 5.1).
- **Unidade** (unit): belongs to a condominium (apartment, house, commercial room).
- **Usuário** (user): a person, with one or more role links (management company / building manager / resident) and links to one or more units.
- **Cobrança** (charge): linked to a unit, with amount, due date, status (pending, paid, overdue, under agreement) and the payment gateway's external reference.
- **Chamado** (ticket): opened by a building manager or resident, with category, status, message history and an assignee.
- **Documento** (document): a file linked to a condominium (minutes, meeting notice, financial statement, service photo), with control over who can view it.
- **Aviso** (announcement): a broadcast message to a condominium or a specific unit, with delivery channels (app, email, WhatsApp).
- **Reserva** (booking): linked to a common area and a unit, with start and end date/time.
- **ÁreaComum** (common area): bookable spaces (party hall, barbecue area, etc.) with rules (minimum interval, maximum advance booking).
- **ConversaBot** (bot conversation): history of the resident's interactions with the bot, for auditing and to give context to the human team when a conversation is escalated.

## 4. Roles and permissions (RBAC)

| Role | Visibility | Can do |
|---|---|---|
| Management company | Every condominium in the portfolio | Configure modules, see consolidated finances, manage building manager users |
| Building manager | Only their condominium(s) | Manage tickets, documents, announcements and the condominium's finances, approve residents' tickets |
| Resident | Only their unit | See their own finances, open a ticket (if enabled), book a common area, receive announcements |

Permission is resolved on two levels: role (what the person can do) and tenant/condominium (what they can do it on). This prevents a building manager of one condominium from seeing another's data, even within the same management company.

## 5. Critical flows

### 5.1 Payment flow: sub-account model

Each condominium operates its own **sub-account** in the payment gateway (Asaas or Efí), tied to the condominium's own CNPJ (company registration). This means:

- The payment goes straight into the condominium's account, not into an intermediary Condly account.
- The fee the gateway charges per paid boleto/PIX is deducted from the condominium, exactly as already happens with any collection process today. It is not a Condly cost.
- Condly acts only as an orchestrator: it creates the charge through the API on behalf of the corresponding sub-account and receives the confirmation webhook.

Step by step:
1. The system creates the monthly charge (boleto + PIX) through the gateway API, in the corresponding condominium's sub-account.
2. The gateway returns an external identifier, stored on the Cobrança record.
3. When the resident pays, the gateway fires a **webhook** to the backend confirming the payment.
4. The backend updates the Cobrança status to "paid" automatically, with no manual step.
5. The building manager and management company see the updated status on the financial dashboard in real time.
6. Optionally, the WhatsApp bot sends an automatic confirmation to the resident.

### 5.2 Booking flow through the bot

1. The resident messages the bot asking to book a common area.
2. The bot checks availability in the backend for the requested area and date.
3. If available, the bot creates the booking directly and confirms by message.
4. If there is a conflict, the bot offers the closest free slots.
5. The booking appears automatically on the app calendar, visible to the building manager and other residents.

### 5.3 Ticket flow

1. A building manager or resident opens a ticket (through the app or the bot).
2. If opened by a resident, the ticket starts as "pending triage" and the building manager is notified.
3. The building manager classifies it, assigns someone and follows its status.
4. Every status update triggers a notification to the resident who opened the ticket.

## 6. External integrations

- **Payment gateway** (Asaas or Efí): boleto/PIX generation through each condominium's sub-account, with a confirmation webhook. The per-transaction fee belongs to the condominium, not to Condly.
- **WhatsApp Business API**: the bot's channel.
- **Transactional email** (Resend): announcements and notifications by email as an alternative channel, with the sender showing the management company's name (light co-branding).
- **File storage** (Cloudflare R2): documents, proof-of-service photos, assembly recordings.

## 7. Security and LGPD (Brazil's data protection law)

- Sensitive data (health, residents with special conditions) requires a specific legal basis and must live in fields with stricter access control: building manager and management company only, never other residents, and always with the resident's explicit consent.
- Payment history and warnings must be visible only to the resident themselves, the building manager and the management company.
- Every bot conversation is recorded (ConversaBot) for auditing, since automated decisions (such as confirming a booking) must be traceable.
- Consulting a lawyer specialized in LGPD is recommended before launching the resident profile module with sensitive data.

## 8. AI-assisted development

Condly is developed with the support of an AI coding agent (Claude Code or equivalent) inside VS Code. Since the most expensive risk in this system is a data leak between management companies (a breach of the multi-tenant isolation described in section 2), the project adopts automated verification on top of natural-language instructions: a project memory file, reusable skills for recurring patterns, a multi-tenant security reviewer subagent, and hooks that run lint/typecheck automatically after every edit. See [`boas-praticas-ia.md`](boas-praticas-ia.md) for the full setup.

## 9. Known MVP limitations

Left out of the first version: online voting/assemblies and consumption charts. Also left out, as next roadmap steps (not permanent gaps to hide in a sales conversation):

- Advanced delinquency management (automatic collection schedule with escalation)
- Visitor/front desk control
- Staff management (maintenance, front desk)
- Digital incident log
