# Deployment Guide

## Overview

OpenChinese deploys as two static builds on one Netlify site, backed by Firebase
Auth + Firestore. No server required in production.

| Path | What | Built from |
|---|---|---|
| `/` | Marketing site — Astro, static, indexed | `apps/site` |
| `/app` | The study app — React SPA, `noindex` | `apps/app` |
| `/.netlify/functions/*` | Payment endpoints | `netlify/functions` |

One domain rather than an `app.` subdomain, so backlinks, ad landing pages and
brand searches all accumulate against the same origin. `scripts/assemble-dist.mjs`
nests the app build inside the site build at `/app`; `apps/site/dist` is what
Netlify publishes.

The Hono API server is kept for local development only.

### Changing the domain

Everything public — canonical URLs, `sitemap.xml`, `robots.txt`, OG and Twitter
cards, JSON-LD — derives from `domain` in `apps/site/site.config.ts`. Buying a
real domain is: edit that one value, point DNS at Netlify, add the domain to
Firebase Auth → Settings → Authorized domains, and redeploy.

---

## Netlify + Firebase (recommended)

### 1. Firebase setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Google** sign-in provider: Authentication → Sign-in method → Google
3. Create a **Firestore** database (production mode)
4. Register a web app: Project Settings → Your apps → `</>` → copy the config
5. Deploy security rules: paste `firestore.rules` into Firestore → Rules tab

### 2. Netlify setup

1. Connect your repo to Netlify
2. Build command and publish directory come from `netlify.toml` — leave both
   blank in the UI so there is one source of truth. For reference, the build
   builds the content assets, then both apps, then nests the app's output inside
   the site's at `/app`; the published directory is `apps/site/dist`.
3. Environment variables (Site settings → Environment variables):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ALLOWED_EMAIL=you@gmail.com
```

5. Add your Netlify domain to Firebase Auth → Authorized domains
6. Deploy — `netlify.toml` at repo root handles redirects and caching automatically

### 3. Generate words.db

```bash
pnpm build:words-db
```

This writes `apps/app/public/words.db` (731 HSK 1–4 words), served as a static CDN asset.

**The file is not committed.** It is gitignored, and Netlify regenerates it on every
deploy — `netlify.toml`'s build command runs `build:words-db` before the client build.
Run it once locally so `pnpm dev` has something to load. (It used to be committed,
which meant every branch that touched the schema produced an unmergeable binary:
`build-words-db.ts` assigns a fresh `randomUUID()` per row, so no two builds of the
file are ever byte-identical.)

### 4. Payments (optional — off by default)

Payments stay dormant until `PAYMENT_PROVIDER` is set: the endpoints answer 503,
`VITE_PAYMENTS_ENABLED` stays false, and every content gate is open. To turn them on:

0. **Redeploy `firestore.rules` first** (Firestore → Rules → paste the file → Publish).
   The tightened rules are the *only* thing making entitlements server-authoritative.
   Rules are deployed by hand — there is no CI publishing them — so an existing
   project is still running whatever was pasted last time. Enable gating while the
   old permissive rules are live and any signed-in user can write
   `users/{uid}/entitlements/current` from the browser console and grant
   themselves Pro permanently, for free. Do this step before step 5, and confirm
   in the console that the published rules contain `allow write: if false` under
   `entitlements`.

1. **Use Stripe.** Test mode needs no application, no business details and no
   approval, so you can run a full purchase today. The longer-term
   recommendation is still a merchant of record (Polar or Paddle) so EU VAT
   registration and remittance are handled for you — see the design notes in
   `openspec/` — but that is an account migration, not a code change: swapping
   providers means implementing four methods behind `PaymentProvider`.
2. Create the Firebase service account with the **Cloud Datastore User** role
   only. It is the sole credential able to write entitlements, so scope it
   tightly and rotate it independently of everything else.
3. Set the **server-side** variables from the root `.env.example` in Netlify's
   environment (never with a `VITE_` prefix — that would publish them):
   `PAYMENT_PROVIDER=stripe`, `FIREBASE_SERVICE_ACCOUNT`, `PUBLIC_SITE_URL`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_YEARLY`.
   The MVP offers the subscription only, so the four `STRIPE_PRICE_HSK_*`
   variables can stay unset — see `OFFERED_SKUS` in `apps/app/src/lib/catalog.ts`.
4. Point the Stripe webhook at `https://<your-site>/.netlify/functions/webhook`
   and subscribe to the events listed in the root `.env.example`.
5. Set `VITE_PAYMENTS_ENABLED=true` and redeploy. **Do this last.** It is a
   build-time client flag while `PAYMENT_PROVIDER` is a runtime server one, so
   setting it before step 3 leaves content locked with a checkout that returns
   503 — users can see the paywall but cannot pay. Nothing detects that
   automatically on purpose: a client that opened its gates whenever it could not
   reach the provider would be bypassable by blocking one request.

Before enabling, run `pnpm check:functions-bundle`. It bundles the Netlify
Functions the way Netlify does and exercises them, which typechecking does not
cover — `firebase-admin` cannot be safely inlined (google-gax uses `__dirname`
and loads `.proto` files at runtime), so `netlify.toml` externalises it. Keep
that list and the one in `scripts/check-functions-bundle.mjs` in sync.

Rollback is unsetting `VITE_PAYMENTS_ENABLED`: every gate reopens and there is no
data to migrate back.

Note that content gating is a purchase prompt, not a lock — `words.db` is a public
static asset and remains downloadable by anyone.

### 5. Your own account, and test personas

`pnpm entitlement` writes `users/{uid}/entitlements/current` directly with the
Firebase Admin SDK — the same document and the same credential the payment webhook
uses. It needs `FIREBASE_SERVICE_ACCOUNT` set, or a `service-account.json` in the
repo root (gitignored).

Give yourself permanent access:

```bash
pnpm entitlement owner            # resolves the VITE_ALLOWED_EMAIL account
pnpm entitlement owner <uid>      # or name a uid explicitly
```

`owner` writes `planSource: 'grant'` with no `currentPeriodEnd`. `isPro()` treats a
grant with no expiry as perpetual — correct for your account, and unreachable by a
customer because security rules deny every client write to that path.

Switch personas to see what other users see. The app streams the document with
`onSnapshot`, so the UI changes within a second — no reload, no second Google
account:

```bash
pnpm entitlement free       # demo allowance + paywalls
pnpm entitlement pro        # paying subscriber, a year out
pnpm entitlement expiring   # lapses in 3 days
pnpm entitlement expired    # access stops, studied words are kept
pnpm entitlement past_due   # payment failed, still inside the period
pnpm entitlement packs      # owns HSK 1 and 2 outright, not Pro
pnpm entitlement show       # print the current document, change nothing
```

There is deliberately **no client-side admin flag**. A `VITE_ADMIN_*` check would
be a second, weaker path to the same decision — forgeable from the browser, and
directly contradicting the rule that entitlements are server-authoritative. The
CLI is the only way in, and it is as convenient.

### 6. End-to-end test with a Stripe test account

1. Stripe dashboard → toggle **Test mode** (top right). Everything below happens
   in test mode; no real money moves and no business details are needed.
2. **Product** → add a product, €25, recurring yearly. Copy the **price ID**
   (`price_...`) into `STRIPE_PRICE_PRO_YEARLY`.
3. **Developers → API keys** → copy the test secret key (`sk_test_...`) into
   `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks** → add endpoint
   `https://<your-site>/.netlify/functions/webhook`, subscribe to
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`. Copy the
   signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
5. Redeploy with `VITE_PAYMENTS_ENABLED=true`.
6. `pnpm entitlement free` to drop yourself to the free tier.
7. In the app: HSK 2 should show as locked, `/study?hsk=2` should show a paywall
   rather than an empty session, and the first half of HSK 1 should still work.
8. Pricing page → **Get Pro** → pay with card `4242 4242 4242 4242`, any future
   expiry, any CVC, any postcode.
9. You land back in the app and it flips to Pro **without a reload** — that is the
   webhook writing the entitlement and `onSnapshot` delivering it. If it does not
   flip, check Stripe → Webhooks → the endpoint's recent deliveries; a 400 there
   means `STRIPE_WEBHOOK_SECRET` is wrong, a 503 means `PAYMENT_PROVIDER` is unset
   on Netlify.
10. `pnpm entitlement owner` to put your account back to permanent access.

To test locally instead of against a deploy, `stripe listen --forward-to
localhost:8888/.netlify/functions/webhook` (via `netlify dev`) prints its own
`whsec_` to use for `STRIPE_WEBHOOK_SECRET`.

Going live later is: swap the test keys for live ones, re-point the webhook, and
complete Stripe's account activation. No code changes.

---

## Local development (no auth)

OpenChinese is a self-hosted app. The backend (Hono API + SQLite) and frontend (Vite SPA) run on the same machine. In production you proxy both through Nginx on a single domain so auth cookies work without cross-origin issues.

---

## Local development (no auth)

```bash
pnpm install
pnpm db:push          # create SQLite DB
pnpm dev              # Vite on :5173, API on :3001
```

Open `http://localhost:5173`. Auth is **disabled** unless `GOOGLE_CLIENT_ID` is set.

---

## Production on a VPS (Ubuntu/Debian)

### 1. Prerequisites

```bash
# Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm

# PM2 (process manager)
npm install -g pm2

# Nginx
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Clone and build

```bash
git clone https://github.com/YOU/open-chinese.git /opt/open-chinese
cd /opt/open-chinese

pnpm install
pnpm db:push
pnpm build:app   # outputs to apps/app/dist/
```

### 3. Configure environment

```bash
cp server/.env.example server/.env
nano server/.env
```

Minimum production values:

```env
DATABASE_URL="file:./prisma/prod.db"
PORT=3001
SESSION_SECRET=$(openssl rand -hex 32)   # paste output
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
ALLOWED_EMAIL=you@gmail.com
APP_URL=https://yourdomain.com
NODE_ENV=production
```

### 4. Start the API server with PM2

```bash
cd /opt/open-chinese
pm2 start "pnpm --filter open-chinese-server start" --name open-chinese-api
pm2 save
pm2 startup   # follow the printed instructions to auto-start on reboot
```

### 5. Configure Nginx

```nginx
# /etc/nginx/sites-available/open-chinese
server {
    server_name yourdomain.com;

    # Serve the built Vite SPA
    root /opt/open-chinese/apps/site/dist;
    index index.html;

    # SPA fallback — all non-asset paths serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API and auth to Hono
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/open-chinese /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. HTTPS with Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-edits the Nginx config to add TLS and sets up auto-renewal.

---

## Google OAuth setup

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials → OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Add **Authorised JavaScript origins**: `https://yourdomain.com`
5. Add **Authorised redirect URIs**: `https://yourdomain.com/auth/google/callback`
6. Copy Client ID and Secret into `server/.env`

> Set `ALLOWED_EMAIL=you@gmail.com` to restrict access to your account only.  
> Leave blank to allow any Google account (not recommended for personal deployments).

---

## Updating

```bash
cd /opt/open-chinese
git pull
pnpm install
pnpm db:push           # applies any schema migrations
pnpm build:app
pm2 restart open-chinese-api
```

---

## Backup

The entire database is one SQLite file:

```bash
cp /opt/open-chinese/server/prisma/prod.db ~/backups/open-chinese-$(date +%Y%m%d).db
```

Add to cron for daily backups:

```bash
0 3 * * * cp /opt/open-chinese/server/prisma/prod.db ~/backups/open-chinese-$(date +\%Y\%m\%d).db
```

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | SQLite path, e.g. `file:./prisma/prod.db` |
| `PORT` | no | API port, default `3001` |
| `SESSION_SECRET` | yes (prod) | Random hex string for JWT signing |
| `GOOGLE_CLIENT_ID` | yes (prod) | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | yes (prod) | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | yes (prod) | Must match Google Console setting |
| `ALLOWED_EMAIL` | no | Restrict to one Gmail address |
| `APP_URL` | yes (prod) | Public frontend URL |
| `NODE_ENV` | no | Set to `production` to enable secure cookies |
