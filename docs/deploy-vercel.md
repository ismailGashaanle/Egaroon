# Deploying to Vercel (frontend + backend)

Two Vercel projects from the same repo: **egaroon-api** (root `server`) and **egaroon-web** (root `client`).
Vercel applies environment-variable changes **only to a new deployment** — after editing variables, redeploy.

## Is my deployment live? (check these first)

| Check | What it shows |
|---|---|
| `https://api.egaroon.com/api/health` | The **commit** the API is running, database state, payment mode (`mock` / `sandbox` / `live`), SMS provider, and which integrations are on. No secrets. |
| `https://api.egaroon.com/api/auth/features` | Public settings the website reads (payments mode, captcha, Google sign-in, owner signup). |
| View source of `https://www.egaroon.com` → `<meta name="app-commit">` | The commit the **website** was built from. |

Compare each commit with the newest commit on GitHub. If the API's commit is old, the deployment did not land: open the project's **Deployments** page, look at the top entry, and read its build log.

## 1. Backend — root directory `server`
Framework preset: **Other**. Entry points: `server/api/index.js` (all routes, via the rewrite in `server/vercel.json`) and `server/api/cron.js` (background jobs).

### Required

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Atlas connection string (Atlas → Network Access must allow `0.0.0.0/0`; Vercel has no fixed IPs) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | long random strings |
| `CLIENT_URL` | the website, e.g. `https://www.egaroon.com` (exact; no trailing slash) |
| `API_PUBLIC_URL` | the API's own URL, e.g. `https://api.egaroon.com` (https needed for Sifalo webhooks) |
| `COOKIE_SECURE` | `true` |
| `CRON_SECRET` | long random string (protects `/api/cron`) |

### Payments (Sifalo)

| Variable | Value |
|---|---|
| `PAYMENT_PROVIDER` | `sifalopay` (`mock` shows fake demo buttons that never work in production) |
| `SIFALO_API_USER`, `SIFALO_API_KEY` | the keys for the **same side** as the URL below |
| `SIFALO_API_BASE_URL` | **sandbox keys** → `https://spay-api.sifalo.net/gateway`. **Live keys** → delete this variable (defaults to `https://api.sifalopay.com/gateway`). Mixing sides gives "credentials rejected (code 0)". |

Sandbox test wallets (no real money): Telesom `063 1111111` pays, `063 3333333` stays pending, `063 2222222` fails, `063 4444444` has no balance. `https://api.egaroon.com/api/health` must say `"mode":"sandbox"` or `"live"` as you intend.

### Strongly recommended

| Variable | Why |
|---|---|
| `REDIS_URL` (Upstash `rediss://…`) | Without it, slot locks are per-instance and two captains can race for one slot |
| `OTP_PROVIDER=twilio` + `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Real SMS codes. With `mock` in production **owner withdrawals are refused** (health shows `"sms":"mock"`) |
| `CLOUDINARY_*` or `CLOUDFLARE_R2_*` | Uploads (owner ID documents, photos) |

### Optional features (all off until their variables are set)

| Feature | Variables |
|---|---|
| **Cloudflare Turnstile** bot check on register, login, forgot password, OTP, withdrawals | `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` (both). The website picks the site key up automatically — no frontend change. Current mobile app does not send a token, so it cannot log in while this is on. |
| **Continue with Google** | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Redirect URI in Google Cloud: `https://api.egaroon.com/api/auth/oauth/google/callback` |
| **Demo second login step** (testing only, NOT real security) | `DEMO_2FA_CODE=123456` or several: `DEMO_2FA_CODE=123456,654321`. After a correct password the login asks for one of these codes. Remove before real customers use the site. |

### Notes
- **No Socket.IO** on Vercel: live updates are off; pages update on navigation/reload.
- **Request bodies are capped at 4.5 MB** by Vercel, so very large base64 uploads fail.
- **Background jobs** (hold expiry, match lifecycle, settlement, pending-payment checks) also run opportunistically from normal traffic (at most once a minute), but a real scheduler is still best:
  - Vercel **Pro**: add to `server/vercel.json` `"crons": [{ "path": "/api/cron", "schedule": "* * * * *" }]`.
  - Vercel **Hobby** rejects sub-daily crons. Use an external pinger (cron-job.org, UptimeRobot) calling `GET https://api.egaroon.com/api/cron` with header `Authorization: Bearer <CRON_SECRET>` every minute.
- **Platform Settings → "First captain slot hold (minutes)"** should be about **10**. At 1–2 minutes customers cannot finish a PIN prompt before the slot is released (the settings page now warns when it is under 5).

## 2. Frontend — root directory `client`
Framework preset: **Vite**.

1. `client/vercel.json` rewrites `/api/*` to the backend (currently `https://api.egaroon.com`). The browser only talks to the website's own origin, which avoids CORS and cross-site cookie problems.
2. Environment variables:
   - `VITE_API_URL=/api`
   - `VITE_DISABLE_SOCKET=true`
   - `VITE_CLOUDINARY_CLOUD_NAME=<your cloud name>`

## Order for a fresh setup
Deploy the backend → note its URL → put it in `client/vercel.json` and `API_PUBLIC_URL` → deploy the frontend → set `CLIENT_URL` on the backend → redeploy the backend → open `/api/health`.

## Admin accounts
Create the first super admin with `npm run create-admin` (see `server/scripts/create-admin.js`) using your **production** `MONGO_URI`. Never run `npm run seed` against production — it creates `Demo1234!` accounts.

Rebrand saved site text: `node scripts/rebrand-site-content.js` (preview) / `--apply`.
