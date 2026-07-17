# Deploy de teste (custo zero): Neon + Render + Vercel

Ambiente de **demonstração** — só dados fictícios do seed, nunca dados
reais de condomínio/moradores. Três serviços gratuitos, todos com login
via GitHub, nenhum pede cartão:

| Serviço | O que hospeda | Plano |
| --- | --- | --- |
| [Neon](https://neon.tech) | PostgreSQL | Free (0,5GB) |
| [Render](https://render.com) | API NestJS (`apps/api`) | Free (dorme após ~15min ocioso; 1ª requisição seguinte demora 30–60s) |
| [Vercel](https://vercel.com) | Frontend Next.js/PWA (`apps/web`) | Hobby |

A cada `git push` na branch `main`, Render e Vercel fazem deploy
automático da nova versão.

## 1. Banco — Neon

1. Crie a conta em https://neon.tech (Continue with GitHub).
2. Crie um projeto (nome livre, ex: `condly`) e região `AWS São Paulo`
   (ou a mais próxima).
3. **Nomeie o database `condly_test`** — não é opcional: a trava de
   segurança do seed (`validarBancoDeDesenvolvimento` em
   `prisma/seed.ts`) recusa rodar em bancos sem `_dev`/`_test` no nome.
4. Copie a **connection string** (botão "Connect", formato
   `postgresql://...@....neon.tech/condly_test?sslmode=require`). É o
   valor de `DATABASE_URL` no Render (passo 2) e no seed (passo 3).

## 2. API — Render

1. Conta em https://render.com (GitHub login) → **New → Web Service** →
   conecte o repositório `fdarodrigo/condly`.
2. Configurações (os campos fora desta lista ficam no padrão):
   - **Root Directory**: *(vazio — raiz do repo; monorepo npm workspaces
     precisa do lockfile da raiz)*
   - **Build Command**:
     `npm install && cd apps/api && npx prisma generate && npm run build`
   - **Start Command**:
     `cd apps/api && npx prisma migrate deploy && npm run start:prod`
   - **Instance Type**: Free
   - **Health Check Path**: `/health`
3. Environment Variables (aba Environment). Copie os nomes de
   `apps/api/.env.example`; valores pro ambiente de teste:
   - `NODE_VERSION` = `20`
   - `DATABASE_URL` = connection string do Neon
   - `JWT_SECRET` = **um segredo novo e forte** (ex: saída de
     `openssl rand -hex 32`) — nunca o mesmo do `.env` local
   - `JWT_EXPIRES_IN` = `1d`
   - `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_APP_SECRET` /
     `WHATSAPP_CLOUD_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` /
     `WHATSAPP_API_VERSION` — valores reais da Meta se for testar o bot
     (ver seção do bot no README); senão, os placeholders do `.env.example`
   - `ASAAS_API_URL` / `ASAAS_API_KEY` / `ASAAS_WEBHOOK_TOKEN` /
     `ASAAS_ENV` e `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — placeholders
     do `.env.example` (os fluxos que dependem deles falham de forma
     controlada, igual em dev)
   - `PORT` **não** — o Render injeta o próprio
4. Deploy. Ao final, anote a URL pública
   (`https://<nome>.onrender.com`) — é a `NEXT_PUBLIC_API_URL` do passo 4
   e a base do webhook do WhatsApp.
5. Teste: `https://<nome>.onrender.com/health` deve responder
   `{"status":"ok"}` (a primeira visita pode demorar ~1min: cold start).

## 3. Popular o banco (seed) — da sua máquina

As migrations rodam sozinhas no start do Render (`migrate deploy`); o
seed é manual e destrutivo (recria o cenário demo do zero):

```bash
cd apps/api
DATABASE_URL="<connection string do Neon>" npm run db:seed
```

(A variável passada na linha de comando tem precedência sobre o `.env` —
o banco local não é tocado.)

## 4. Frontend — Vercel

1. Conta em https://vercel.com (GitHub login) → **Add New → Project** →
   importe `fdarodrigo/condly`.
2. Configurações:
   - **Root Directory**: `apps/web`
   - Framework: Next.js (detectado sozinho)
   - **Environment Variable**: `NEXT_PUBLIC_API_URL` =
     `https://<nome>.onrender.com` (URL do Render, sem barra no final)
3. Deploy. A URL final (`https://<projeto>.vercel.app`) é a que se abre
   no celular.

## 5. Instalar o PWA no celular

- **Android/Chrome**: abra a URL do Vercel → banner "Adicionar Condly à
  tela inicial" ou Menu ⋮ → **Instalar app**.
- **iPhone/Safari**: abra a URL → Compartilhar → **Adicionar à Tela de
  Início**.

Login com os usuários demo (`Demo123!`) — ver "Dados de demonstração" no
README. Como a URL do Vercel é fixa, o app instalado continua válido a
cada novo deploy.

## 6. (Opcional) Webhook do bot do WhatsApp

Com a API no Render, o webhook da Meta ganha URL estável:
`https://<nome>.onrender.com/webhooks/whatsapp` — cadastre no painel da
Meta com o `WHATSAPP_VERIFY_TOKEN` configurado no Render. Atenção ao free
tier: com a API dormindo, o primeiro webhook após ocioso pode estourar o
timeout da Meta (ela reenvia, então funciona no retry — conviver com
isso ou manter a instância acordada com um ping periódico).

## Ressalvas do ambiente de teste

- Free tier do Render dorme: primeira requisição após ocioso leva
  30–60s (o login "pendura" e depois anda).
- O seed é destrutivo e o banco é de demonstração — rode o seed de novo
  sempre que quiser resetar o cenário.
- Nada de dados reais até uma revisão de produção (backups, logs,
  rotação de segredos, domínio próprio).
