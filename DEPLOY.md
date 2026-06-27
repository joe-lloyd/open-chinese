# Deployment Guide

## Overview

OpenChinese deploys as a static SPA on Netlify backed by Firebase Auth + Firestore. No server required in production.

The Hono API server is kept for local development only.

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
2. Build command: `pnpm --filter client build`
3. Publish directory: `client/dist`
4. Environment variables (Site settings → Environment variables):

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

This writes `client/public/words.db` (731 HSK 1–4 words). Commit the file; it's served as a static CDN asset.

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
pnpm --filter client build   # outputs to client/dist/
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
    root /opt/open-chinese/client/dist;
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
pnpm --filter client build
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
| `WHISPER_BACKEND` | no | `api` or `local` |
| `OPENAI_API_KEY` | no | Required if `WHISPER_BACKEND=api` |
