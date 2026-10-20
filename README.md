# Napizzo

Platform where pizzerias and fast foods sign up, get a 3-month free trial, then subscribe monthly, and build a fully customisable online shop page (menu, online orders, opening hours, contact). Platform and shop pages work in English, Français and العربية (RTL), in any combination.

## Run
Requires Node >= 22.13 (uses built-in `node:sqlite`, zero npm dependencies).

    npm start        # http://localhost:3000  (PORT env to change)
    npm test

Static demo (no backend, data in localStorage) for hosting under any sub-path:  `npm run build:preview` → `dist/`.

Data lives in `data/` (SQLite + uploaded images).

## Production
https://napizzo.rayanemelzi.dev — Cloudflare tunnel → nginx (`deploy/nginx-napizzo.conf`) → `127.0.0.1:3000`
(systemd unit `napizzo`, code in `/opt/napizzo`, data in `/opt/napizzo/data`, never overwritten).
Deploy from a checkout on the server: `bash deploy/deploy.sh` (runs the tests, syncs, restarts).
`HOST`, `PORT` and `TRUST_PROXY=1` (rate limits use `X-Real-IP`) are set in the unit.

CI (`.github/workflows/ci.yml`, GitHub Actions): on every push to `main` and every PR — `node --check` on all JS, `npm test` on Node 22 and 24, then `npm run build:preview` uploaded as the `napizzo-preview` artifact.

## Overview
- `server.js` – HTTP API, auth (scrypt + cookie sessions), shop/menu/orders/billing, public shop route `/s/:slug`
- `lib/shop-page.js` – server-rendered shop page (themes, sections, per-language texts, cart)
- `lib/templates.js` – themes and trilingual starter menus (pizzeria, burger, tacos, sandwich, other)
- `public/` – platform SPA (landing, 4-step wizard, design editor with live preview, menu, orders with sound alert, settings, billing)

## Notes / next steps
- Billing is a **demo provider**: card is Luhn-validated, only the last 4 digits stored, 30 days granted per payment. Plug Stripe (or a local gateway) into `/api/billing/subscribe`.
- Orders are cash-only; no email/SMS notifications (dashboard polls every 8s and beeps).
- Add HTTPS (`Secure` cookie) behind a reverse proxy for production.

## Design system
Redesign from `design_handoff_napizzo/`: tokens + `.nz-*` components in `public/style.css`, helpers in `public/nz.js`
(icons, toast, modal with focus trap), gallery at `/nz-components.html`. Platform copy lives in `public/i18n.js`
(`a.*` platform, `sh.*` shop page). Shop pages are themed only via `--p --a --bg --card --t --r --f` + `data-hero`.
Choices: password min 8 chars; no "forgot password" or pickup-off switch yet (no backend support).
