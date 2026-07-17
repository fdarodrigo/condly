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
npm install --legacy-peer-deps
```

`--legacy-peer-deps` é necessário: há um conflito real de peer dependency
entre as ferramentas Angular devkit trazidas por `@nestjs/schematics`/
`@nestjs/cli` e a versão de `rxjs` exigida por outras dependências — sem a
flag, o `npm install` padrão (resolução estrita de peer deps) falha. Se
precisar adicionar uma dependência nova em qualquer um dos apps, use a
mesma flag (`npm install <pacote> --legacy-peer-deps`), senão o pacote
pode ficar sem alguma peer dependency instalada (foi o caso de
`@testing-library/dom` ao configurar o Vitest em `apps/web`).

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

## Dados de demonstração

`npm run db:seed` (em `apps/api`, lê `DATABASE_URL` — recusa rodar fora de
um banco `_dev`/`_test`, ver `validarBancoDeDesenvolvimento` em
`prisma/seed.ts`) popula um cenário fixo de demonstração: 1 administradora,
10 condomínios (174 unidades no total), 109 usuários (1 administradora, 1
síndico por condomínio e até 10 condôminos por condomínio), com cobranças,
reservas, chamados, avisos, enquetes, assembleias, ações administrativas,
documentos, advertências e dados complementares de unidade distribuídos
entre eles. **É destrutivo** — apaga todo o conteúdo das tabelas de domínio
antes de recriar o cenário.

### Credenciais

Senha de todos os usuários de demonstração: **`Demo123!`**

| Papel | E-mail | Vínculo |
| --- | --- | --- |
| ADMINISTRADORA | `administradora.demo@condly.app` | Administradora "Administradora Demo" (carteira com os 10 condomínios) |
| SINDICO | `sindico.demo@condly.app` | Condomínio "Residencial Ipê Verde" (1º da lista) |
| SINDICO | `sindico{N}.demo@condly.app` (N = 2..10) | N-ésimo condomínio da lista (ex: `sindico2.demo` → Edifício Maracanã) |
| CONDOMINO | `condomino{J}.demo@condly.app` (J = 1..10) | J-ésima unidade do Residencial Ipê Verde (101, 102, 103, ...) |
| CONDOMINO | `condomino{J}.c{N}.demo@condly.app` | J-ésima unidade do N-ésimo condomínio (ex: `condomino1.c2.demo` → unidade 101 do Edifício Maracanã) |

Ordem dos condomínios (a mesma de `CONDOMINIOS_CONFIG` em `prisma/seed.ts`):
1. Residencial Ipê Verde, 2. Edifício Maracanã, 3. Condomínio Solar das
Pedras, 4. Torres do Parque, 5. Villagio Toscana (8 unidades — só 8
condôminos), 6. Residencial Bela Vista, 7. Edifício Copacabana Club,
8. Condomínio Rio Branco, 9. Residencial Alegria, 10. Boulevard Jardins.

Os 5 logins originais (`administradora.demo`, `sindico.demo`,
`condomino1..3.demo`) continuam exatamente os mesmos.

### O que cada login tem pra mostrar

- **Administradora** (`/dashboard` e `/administradora/dashboard`): carteira
  com 10 condomínios, adimplência variada (62%–100%), 16 chamados abertos
  na carteira, rankings de arrecadação/inadimplência com 10 itens e
  serviços periódicos a vencer nos próximos 30 dias.
- **Síndico do Ipê Verde** (`/dashboard`): resumo financeiro do mês (9
  pagas, 3 pendentes), 3 chamados (1 ABERTO, 1 PENDENTE_TRIAGEM aberto pela
  condômina da 101, 1 RESOLVIDO aberto pelo condômino da 102); em
  `/enquetes`, 3 enquetes (ATIVA com votos, ENCERRADA com resultado,
  RASCUNHO); em `/assembleias`, 1 AGENDADA (com edital) e 1 REALIZADA (com
  deliberações, ata e link de gravação); em `/acoes-administrativas`, 3
  ações; em `/documentos`, 3 documentos (1 restrito a síndico/adm); 2
  advertências emitidas; dados complementares preenchidos nas unidades
  101–103. Os outros 9 síndicos têm cenários equivalentes mais enxutos.
- **Condôminos** (`/minha-unidade`): os 3 primeiros de cada condomínio têm
  cobrança PENDENTE/ATRASADA (nunca caem no bloco PAGO); todos têm pelo
  menos 1 aviso não lido em `/avisos`; os condôminos 1–3 têm reserva futura
  confirmada; no Ipê Verde, condôminos 1–6/1–8 já votaram nas enquetes
  ativa/encerrada e podem ver o resultado parcial.

**Observação sobre `/reservas`:** a tela usa "amanhã" como data padrão, mas
as reservas do seed começam 3 dias a partir do momento em que o seed roda
— então, no dia em que o seed for executado, a view padrão (amanhã) pode
aparecer com tudo livre. Avance a data no formulário (próximos ~3 a 20
dias) para ver horários "Reservado" de verdade.

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
