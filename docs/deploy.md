# Test deploy (zero cost): Neon + Render + Vercel

A **demo** environment: only fictitious seed data, never real
condominium/resident data. Three free services, all with GitHub sign-in,
none asking for a credit card:

| Service | Hosts | Plan |
| --- | --- | --- |
| [Neon](https://neon.tech) | PostgreSQL | Free (0.5 GB) |
| [Render](https://render.com) | NestJS API (`apps/api`) | Free (sleeps after ~15 min idle; the next request takes 30 to 60 s) |
| [Vercel](https://vercel.com) | Next.js frontend/PWA (`apps/web`) | Hobby |

On every `git push` to `main`, Render and Vercel deploy the new version
automatically.

## 1. Database: Neon

1. Create an account at https://neon.tech (Continue with GitHub).
2. Create a project (any name, e.g. `condly`) in region `AWS São Paulo`
   (or the closest one).
3. **Name the database `condly_test`**. This is not optional: the seed's
   safety check (`validarBancoDeDesenvolvimento` in `prisma/seed.ts`)
   refuses to run on databases without `_dev`/`_test` in the name.
4. Copy the **connection string** ("Connect" button, format
   `postgresql://...@....neon.tech/condly_test?sslmode=require`). It is the
   value of `DATABASE_URL` on Render (step 2) and for the seed (step 3).

## 2. API: Render

1. Account at https://render.com (GitHub sign-in) → **New → Web Service** →
   connect the `fdarodrigo/condly` repository.
2. Settings (fields not listed stay at their defaults):
   - **Root Directory**: *(empty, the repo root; an npm workspaces monorepo
     needs the root lockfile)*
   - **Build Command**:
     `npm install && cd apps/api && npx prisma generate && npm run build`
   - **Start Command**:
     `cd apps/api && npx prisma migrate deploy && npm run start:prod`
   - **Instance Type**: Free
   - **Health Check Path**: `/health`
3. Environment Variables (Environment tab). Copy the names from
   `apps/api/.env.example`; values for the test environment:
   - `NODE_VERSION` = `20`
   - `DATABASE_URL` = the Neon connection string
   - `JWT_SECRET` = **a new, strong secret** (e.g. the output of
     `openssl rand -hex 32`), never the same as your local `.env`
   - `JWT_EXPIRES_IN` = `1d`
   - `WHATSAPP_VERIFY_TOKEN` / `WHATSAPP_APP_SECRET` /
     `WHATSAPP_CLOUD_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` /
     `WHATSAPP_API_VERSION`: real Meta values if you will test the bot;
     otherwise, the `.env.example` placeholders
   - `ASAAS_API_URL` / `ASAAS_API_KEY` / `ASAAS_WEBHOOK_TOKEN` /
     `ASAAS_ENV` and `RESEND_API_KEY` / `RESEND_FROM_EMAIL`: the
     `.env.example` placeholders (flows that depend on them fail in a
     controlled way, same as in dev)
   - **Not** `PORT`: Render injects its own
4. Deploy. When it finishes, note the public URL
   (`https://<name>.onrender.com`). It is the `NEXT_PUBLIC_API_URL` of step 4
   and the base of the WhatsApp webhook.
5. Test: `https://<name>.onrender.com/health` should answer
   `{"status":"ok"}` (the first visit can take ~1 min: cold start).

## 3. Populate the database (seed) from your machine

Migrations run by themselves when Render starts (`migrate deploy`); the
seed is manual and destructive (it recreates the demo scenario from
scratch):

```bash
cd apps/api
DATABASE_URL="<Neon connection string>" npm run db:seed
```

(A variable passed on the command line takes precedence over `.env`, so
the local database is not touched.)

## 4. Frontend: Vercel

1. Account at https://vercel.com (GitHub sign-in) → **Add New → Project** →
   import `fdarodrigo/condly`.
2. Settings:
   - **Root Directory**: `apps/web`
   - Framework: Next.js (detected automatically)
   - **Environment Variable**: `NEXT_PUBLIC_API_URL` =
     `https://<name>.onrender.com` (the Render URL, no trailing slash)
3. Deploy. The final URL (`https://<project>.vercel.app`) is the one to open
   on the phone.

## 5. Install the PWA on a phone

- **Android/Chrome**: open the Vercel URL → "Add Condly to home screen"
  banner, or Menu ⋮ → **Install app**.
- **iPhone/Safari**: open the URL → Share → **Add to Home Screen**.

Sign in with the demo users (password `123`), see "Demo data" in the
README. Since the Vercel URL is fixed, the installed app keeps working
after every new deploy.

## 6. (Optional) WhatsApp bot webhook

With the API on Render, the Meta webhook gets a stable URL:
`https://<name>.onrender.com/webhooks/whatsapp`. Register it in the Meta
dashboard with the `WHATSAPP_VERIFY_TOKEN` set on Render. Beware of the
free tier: with the API asleep, the first webhook after idling may exceed
Meta's timeout (Meta redelivers, so it works on the retry; either live with
that or keep the instance awake with a periodic ping).

## Test environment caveats

- Render's free tier sleeps: the first request after idling takes 30 to
  60 s (login "hangs", then goes through).
- The seed is destructive and the database is for demos: run the seed again
  whenever you want to reset the scenario.
- No real data until a production review (backups, logging, secret
  rotation, custom domain).
