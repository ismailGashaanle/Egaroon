# E-GAROON — Server

Node.js / Express API for the E-GAROON platform.

---

## Setup

`ash
cp .env.example .env   # fill in all required vars
npm install
npm run seed           # seed demo users + stadium data
npm run dev            # nodemon
`

---

## Environment Variables

See .env.example for the full list. Required minimum:

| Variable | Purpose |
|----------|---------|
| MONGODB_URI | MongoDB connection string |
| REDIS_URL | Redis connection string |
| JWT_ACCESS_SECRET | Access token signing secret |
| JWT_REFRESH_SECRET | Refresh token signing secret |
| PAYMENT_PROVIDER | mock (dev) or waafipay / dahabpay |
| OTP_PROVIDER | mock (dev) or twilio (Twilio Verify for phone SMS) |
| TWILIO_ACCOUNT_SID / AUTH_TOKEN / VERIFY_SERVICE_SID | Required when OTP_PROVIDER=twilio (server only) |
| PLATFORM_COMMISSION_PERCENT | Default 4 |
| BOOKING_HOLD_MINUTES | Default 10 |
| TEAM_B_PAYMENT_MINUTES | Default 10 |
| SETTLEMENT_SAFETY_MINUTES | Default 75 |
| NODE_ENV | development / production |
| CLIENT_URL | CORS origin for the React SPA |

---

## Routes (current — no /v1 prefix yet)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | Public | Register captain or owner |
| POST | /api/auth/login | Public | Login |
| POST | /api/auth/refresh | Cookie | Refresh access token |
| POST | /api/auth/logout | Bearer | Logout |
| GET | /api/auth/me | Bearer | Current user |
| POST | /api/teams | captain | Create team |
| GET | /api/teams | captain | Own teams |
| GET | /api/teams/:id | Optional | Team detail |
| PATCH | /api/teams/:id | captain (owner) | Update team |
| POST | /api/teams/:id/players | captain | Add player |
| DELETE | /api/teams/:id/players/:pid | captain | Remove player |
| GET | /api/stadiums | Optional | Search/list stadiums |
| POST | /api/stadiums | owner | Create stadium |
| GET | /api/stadiums/:id | Optional | Stadium detail |
| PATCH | /api/stadiums/:id | owner/admin | Update stadium |
| DELETE | /api/stadiums/:id | owner | Delete stadium |
| POST | /api/stadiums/:id/verify | admin/super | Verify stadium |
| GET | /api/stadiums/:id/fields | Optional | Fields for stadium |
| POST | /api/stadiums/:id/fields | owner | Add field |
| GET | /api/fields/:id | Optional | Field detail |
| PATCH | /api/fields/:id | owner | Update field |
| DELETE | /api/fields/:id | owner | Delete field |
| GET | /api/fields/:id/slots | Optional | Slot availability |
| GET | /api/fields/:id/availability | Optional | Availability blocks |
| POST | /api/fields/:id/availability | owner/manager | Create block |
| DELETE | /api/availability-blocks/:id | owner/manager | Delete block |
| PATCH | /api/availability-blocks/:id | owner/manager | Update block |
| POST | /api/bookings | captain | Create booking (HELD) |
| GET | /api/bookings | captain/owner/admin | List bookings |
| GET | /api/bookings/:id | participant/admin | Booking detail |
| POST | /api/bookings/:id/invite-team-b | captain (A) | Invite Team B |
| POST | /api/bookings/:id/cancel | captain/admin | Cancel |
| POST | /api/bookings/:id/check-in | captain/manager | QR check-in |
| POST | /api/payments | captain | Create payment intent |
| GET | /api/payments/:id | payer/admin | Payment detail |
| POST | /api/payments/:id/mock-confirm | — | Dev only; simulates webhook |
| POST | /api/webhooks/payment | Provider sig | WaafiPay/DahabPay webhook |
| POST | /api/bookings/:id/settle | admin | Manual settlement |
| POST | /api/maintenance/expire-stale-holds | admin | Expire stale holds |
| GET | /api/tournaments | Optional | Browse tournaments |
| POST | /api/tournaments | owner | Create tournament |
| GET | /api/tournaments/:id | Optional | Tournament detail |
| POST | /api/tournaments/:id/register | captain | Register team |
| POST | /api/tournaments/:id/fixtures/generate | owner | Generate fixtures |
| PATCH | /api/tournaments/fixtures/:id/result | owner | Record result |
| GET | /api/admin/users | admin/super | User list |
| PATCH | /api/admin/users/:id/status | admin | Suspend/activate |
| PATCH | /api/admin/users/:id/role | super | Role change |
| GET/PATCH | /api/platform/settings | super | Platform config |
| GET/POST/PATCH | /api/platform/content | super | Site content CMS |
| POST | /api/upload/* | Bearer | Cloudinary upload |

---

## Background Jobs (jobs/scheduler.js)

| Job | Schedule | Action |
|-----|----------|--------|
| expireStaleHolds | Every 1 min | HELD/PAYMENT_PENDING → EXPIRED |
| dvanceMatchLifecycle | Every 5 min | CHECKED_IN → IN_PROGRESS → COMPLETED |
| processSettlements | Every 15 min | COMPLETED → SETTLED (after safety window) |

---

## Architecture Notes

- Controllers are thin wrappers; all business logic in services/
- PaymentProviderFactory in providers/payment/index.js selects provider from PAYMENT_PROVIDER env var
- Redis key pattern for slot locks: slot-lock:{fieldId}:{isoStartTime}
- MongoDB partial unique index on bookings guards against double-booking (see config/mongoIndexes.js)

See full documentation in [/docs](../docs/).
