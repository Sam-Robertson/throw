# Deployment Guide — Throw Studio

## Environment Variables

Set all of the following in Vercel → Project Settings → Environment Variables
before the first deploy.

| Variable                | Description                                              |
|-------------------------|----------------------------------------------------------|
| `DATABASE_URL`          | Neon pooled connection string                            |
| `DIRECT_URL`            | Neon direct connection string (used by Prisma Migrate)   |
| `NEXTAUTH_SECRET`       | Random 32-char string: `openssl rand -base64 32`         |
| `NEXTAUTH_URL`          | `https://your-app.vercel.app`                            |
| `STRIPE_SECRET_KEY`     | From Stripe Dashboard → Developers → API keys            |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks (set after step 5)      |
| `TWILIO_ACCOUNT_SID`    | From Twilio console                                      |
| `TWILIO_AUTH_TOKEN`     | From Twilio console                                      |
| `TWILIO_PHONE_NUMBER`   | From Twilio console (E.164 format, e.g. +15005550006)    |
| `RESEND_API_KEY`        | From Resend dashboard                                    |
| `NEXT_PUBLIC_APP_URL`   | `https://your-app.vercel.app`                            |

Future (add when Inngest functions are wired up):

| Variable               | Description                         |
|------------------------|-------------------------------------|
| `INNGEST_EVENT_KEY`    | From Inngest dashboard → Event keys |
| `INNGEST_SIGNING_KEY`  | From Inngest dashboard → Signing key|

---

## Deploy Steps

### 1. Push repo to GitHub

```bash
git add -A
git commit -m "initial commit"
git push origin main
```

### 2. Create Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Vercel auto-detects Next.js; leave framework settings as-is
4. Add all env vars from the table above (**skip** `STRIPE_WEBHOOK_SECRET` for now)
5. Click **Deploy**

### 3. Run database migrations

After the first deploy (or any time the schema changes), run migrations against
the Neon direct connection string:

```bash
DATABASE_URL="<your-DIRECT_URL>" npx prisma migrate deploy
```

Or use the Neon console to run migrations manually.

### 4. Set up Stripe webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → Webhooks**
2. Click **Add endpoint**
3. URL: `https://your-app.vercel.app/api/webhooks/stripe`
4. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** shown on the webhook details page

### 5. Add webhook secret to Vercel

1. Vercel → Project → Settings → Environment Variables
2. Add `STRIPE_WEBHOOK_SECRET` = the signing secret from step 4
3. **Redeploy** (trigger via `git push` or Vercel dashboard → Redeploy)

### 6. Set up Inngest (when ready)

1. Create an account at [inngest.com](https://inngest.com)
2. Add `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` to Vercel env vars
3. In Inngest dashboard, register the endpoint:
   `https://your-app.vercel.app/api/inngest`

---

## Neon Connection Strings

Neon requires two URLs for Prisma:

- **`DATABASE_URL`** — pooled connection (PgBouncer), used at runtime
- **`DIRECT_URL`** — direct connection, used by `prisma migrate deploy`

Both are available in the Neon console under your database → **Connection Details**.
Select **Pooled** for `DATABASE_URL` and **Direct** for `DIRECT_URL`.

Add `?sslmode=require` if not already present in the connection strings.
