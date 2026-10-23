# Browser smoke test

Logs in, claims a waiting chat and replies, saves settings, and checks the error and expired-login paths.

Needs dam-backend running with a database and a staff account:

```bash
# dam-backend
SEED_ADMIN_EMAIL=e2e@example.com SEED_ADMIN_PASSWORD=e2e-password npm run seed:admin
npm start

# dam-admin (builds and serves on :4173 by itself)
E2E_ADMIN_EMAIL=e2e@example.com E2E_ADMIN_PASSWORD=e2e-password npm run test:e2e
```

`VITE_API_BASE_URL` (from `.env`) must point at that backend. Use a test database: the test creates a chat and re-saves settings.
