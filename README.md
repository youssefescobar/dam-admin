# DAMAC — Durrah Al Munawwara Admin Console

Staff console for Durrah Al Munawwara: quotes, live chat inbox, reports, Durra AI knowledge base, website content, insights and company settings. Talks to `dam-backend` over HTTP and Socket.io.

Stack: Vite + React + TypeScript, Tailwind + shadcn/ui (Radix), TanStack Query/Table, socket.io-client, vite-plugin-pwa.

## Setup

```bash
cp .env.example .env   # VITE_API_BASE_URL=http://127.0.0.1:3000
npm install
npm run dev            # http://127.0.0.1:5173 (dam-backend must be running)
```

`VITE_API_BASE_URL` is the backend's address and is baked in at build time. The backend's `CORS_ORIGIN` must allow this app's origin.

Staff accounts are created on the server with `npm run seed:admin` in `dam-backend` (set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`). Everyone can then change their own password from the profile menu; that signs out their other devices.

## Pages

| Route | Purpose |
|-------|---------|
| `/login` | Sign in |
| `/quotes` | Quote requests as a table or a board; price, notes, department, won/lost |
| `/inbox` | Chats waiting for a person: claim, reply, close (`?c=<id>` opens one) |
| `/reports` | Complaints and job applications from Durra AI, with attached files |
| `/kb` | Knowledge base Durra AI answers from; CSV import adds and updates, never deletes |
| `/content` | Website news and testimonials, with photo/video uploads |
| `/insights` | Handover and miss rates, unanswered questions |
| `/settings` | Company details, SLAs, office hours and bot greetings |

## Checks

```bash
npm run lint    # oxlint, 0 warnings expected
npm run build   # type-check + production build
npm run test:e2e  # browser smoke test; needs dam-backend + MongoDB, see e2e/README.md
```

Pull requests run lint and build in GitHub Actions.

## Phone alerts (PWA)

The app is installable and sends Web Push alerts (new quotes, chats waiting, reminders). The backend needs VAPID keys (`npx web-push generate-vapid-keys` in `dam-backend`). Turn alerts on from the sidebar or the profile menu; signing out turns them off for that device. Production must be HTTPS; on iPhone, add the app to the Home Screen first (iOS 16.4+).

## Deploy

Pushing to `master` builds with the production `VITE_API_BASE_URL` (set in `.github/workflows/deploy.yml`) and copies `dist/` to the droplet at `/var/www/dam-admin/`. An open tab offers a reload when a new version is live.
