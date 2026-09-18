# Damic Admin

React admin console for Damic (sibling of `dam-backend`).

Stack: Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Query/Table + assistant-ui + Socket.io client.

## Setup

```bash
# from DAMT/
cd dam-admin
cp .env.example .env
npm install
```

`.env`:

```
VITE_API_BASE_URL=http://127.0.0.1:3000
```

## Dev (two terminals)

```bash
# terminal 1 — API
cd dam-backend
npm start

# terminal 2 — admin SPA
cd dam-admin
npm run dev
```

Open **http://127.0.0.1:5173**

Default seed admin (after `npm run seed:admin` in backend): `admin@damic.local` / `changeme123`

CORS: backend `.env` can use `CORS_ORIGIN=*` or `http://127.0.0.1:5173`.

## Screens

| Route | Purpose |
|-------|---------|
| `/login` | JWT login |
| `/quotes` | Quotes table + detail dialog (price, notes, won/lost) |
| `/inbox` | Escalation queue + claim / close + assistant-ui thread |
| `/kb` | Knowledge base CRUD + CSV import (embeds on save) |
| `/ai` | AI playground — assistant-ui + `POST /chat/message` |

## PWA & phone notifications

`dam-admin` is installable (manifest + service worker via `vite-plugin-pwa`).

1. Backend `.env` must have VAPID keys (`npx web-push generate-vapid-keys` in `dam-backend`).
2. Log in → sidebar **Enable notifications** (allows browser permission + `POST /push/subscribe`).
3. New quotes and chat escalations wake subscribed admin devices (Web Push — **not** Firebase).
4. Production must be **HTTPS**. On iOS, Add to Home Screen first (Safari 16.4+).

## Production build

```bash
npm run build
# static files in dist/ — host on HTTPS for install + push
```

## Backend relationship

This React app is the admin UI. The portable customer chat widget stays at `dam-backend/public/widget/` for the main website.
