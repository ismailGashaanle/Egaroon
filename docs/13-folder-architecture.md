# E-GAROON — Folder Architecture

**Version:** 1.0  
**Related:** [08-hld.md](./08-hld.md), [09-lld.md](./09-lld.md)

---

## 1. Repository Root

```text
kulansiiye/
├── docs/                    ← Master documentation (this folder)
├── server/                  ← Node.js / Express API
├── client/                  ← React / Vite SPA
├── README.md
└── .cursor/
    └── rules/
        └── kulansiiye.mdc   ← AI: read /docs first
```

---

## 2. Backend — Target Structure

```text
server/
├── src/
│   ├── config/              env, MongoDB, Redis
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── repositories/        (target — optional abstraction over models)
│   ├── middleware/          or middlewares/
│   ├── validators/
│   ├── utils/
│   ├── constants/             roles, booking/payment statuses
│   ├── events/
│   ├── sockets/
│   ├── jobs/                cron / BullMQ workers
│   ├── providers/
│   │   └── payment/
│   │       ├── PaymentProvider.js
│   │       ├── WaafiPay/
│   │       └── DahabPay/
│   ├── modules/             (target modular layout)
│   │   ├── auth/
│   │   ├── users/
│   │   ├── teams/
│   │   ├── stadiums/
│   │   ├── fields/
│   │   ├── bookings/
│   │   ├── payments/
│   │   ├── tournaments/
│   │   ├── notifications/
│   │   ├── disputes/
│   │   └── admin/
│   ├── app.js
│   └── server.js
├── tests/
├── .env.example
├── package.json
└── README.md
```

---

## 3. Backend — Current MVP Structure

```text
server/src/
  app.js
  server.js
  config/
    db.js             ← MongoDB connect
    redis.js          ← ioredis client
    env.js            ← validated env vars
    mongoIndexes.js   ← createIndexes() helper
    contacts.js       ← platform contact config
  constants/
    bookingStatus.js
    paymentStatus.js
    fieldFormats.js
    roles.js
  middleware/
    auth.js           ← authenticate, authorize
    errorHandler.js
    rateLimiters.js
    validate.js
  models/             ← Mongoose schemas
    User, Team, Stadium, Field
    AvailabilityBlock, RecurringBooking, Discount
    Booking, Payment, Lineup
    Tournament, TournamentTeam, Fixture
    Notification, OtpCode
    PlatformSettings, SiteContent, StadiumManager
    WeatherCity
  controllers/        ← thin; delegates to services
  services/           ← business logic
    availability.service.js
    booking.service.js
    payment.service.js
    pricing.service.js
    slot.service.js
    profitReport.service.js
    businessPlanner.service.js
    lineup.service.js
    team.service.js
    tournament.service.js
    manager.service.js
    notification.service.js
    platformSettings.service.js
    weather.service.js
    siteContent.service.js
    stadiumSearch.service.js
    otp.service.js
    otpProviders/          ← OTP delivery adapters (mock / Twilio Verify / AT stub)
      OtpProvider.js
      MockOtpProvider.js
      TwilioVerifyProvider.js
      AfricasTalkingProvider.js
      index.js
    cloudinary.service.js
  routes/             ← one file per resource
  sockets/
    index.js
  providers/
    payment/
      PaymentProvider.js   ← abstract base class
      MockProvider.js      ← default dev provider
      WaafiPayProvider.js  ← stub (credentials required)
      DahabPayProvider.js  ← stub (credentials required)
      index.js             ← PaymentProviderFactory
  jobs/
    scheduler.js      ← interval: expireHolds, advanceBookings, processSettlements, lineup cleanup (BR-007d)
  utils/
    ApiError.js       ← error class
    ApiResponse.js    ← response wrapper
    asyncHandler.js
    bookingPass.js    ← QR / match pass helpers
    formations.js     ← formation presets
    geo.js            ← haversine distance
    somaliPhone.js    ← phone normalization
    tokens.js         ← JWT helpers
```

API mounted at `/api` (not yet `/api/v1`).

---

## 4. Frontend — Target Structure

```text
client/
├── src/
│   ├── app/                 Redux store
│   ├── assets/
│   ├── components/
│   │   ├── ui/
│   │   ├── common/
│   │   ├── booking/
│   │   ├── stadium/
│   │   ├── team/
│   │   └── tournament/
│   ├── features/            Redux slices
│   │   ├── auth/
│   │   ├── teams/
│   │   ├── stadiums/
│   │   ├── bookings/
│   │   ├── payments/
│   │   ├── tournaments/
│   │   └── notifications/
│   ├── pages/
│   │   ├── captain/
│   │   ├── owner/
│   │   ├── admin/
│   │   └── super-admin/
│   ├── hooks/
│   ├── services/            or api/
│   ├── store/
│   ├── routes/
│   ├── layouts/
│   ├── lib/
│   └── utils/
├── package.json
└── README.md
```

---

## 5. Frontend — Current MVP Structure

```text
client/src/
  app/store.js
  api/                       axios modules per resource
  features/                  Redux slices
    auth/
    ui/                      (theme, modal, etc.)
    teams/
    stadiums/
    bookings/
  hooks/                     useAuth, useSocket, useTheme
  i18n/
    locales/                 Somali + English locale JSON (planned rollout)
  lib/                       roles, statusStyles, socket singleton
  components/
    common/                  Button, Card, Badge, Modal, ...
    layout/                  Navbar, DashboardLayout, ...
    stadium/                 StadiumCard, SlotPicker, ...
    booking/                 BookingCard, MatchPass (QR)
  pages/                     marketing + role dashboards
    owner/
    admin/
    superadmin/
  routes/                    AppRoutes, ProtectedRoute, RoleRoute
```

Page folders use mixed naming (`owner/`, `admin/`, `superadmin/`, captain pages at `pages/` root) — refactor to target layout is optional.

---

## 6. Spec vs Implementation Drift

| Spec target | Current MVP | Notes |
|-------------|-------------|-------|
| Sonner (toasts) | **react-hot-toast** | Functionally equivalent |
| Lucide React (icons) | **react-icons/fi** (Feather set) | Same visual language |
| React Hook Form + Zod | Partial / manual forms | Adopt gradually on complex forms |
| `/api/v1/*` | `/api/*` | Version prefix planned |
| `modules/` backend | Flat controllers/services | Refactor when module count grows |
| WaafiPay / DahabPay | `mock` provider (stubs exist) | Needs live credentials — see [14-payment-design.md](./14-payment-design.md) |
| `repositories/` layer | Direct Mongoose in services | Acceptable for MVP |
| Tournament pages | **Done** — full client + backend | Phase 8 complete |
| i18n (Somali/English) | `i18n/locales/` present | Rollout in progress |
| Permission-level RBAC | Role-only middleware | Phase 9 — planned |

**Documentation uses the spec stack as the target.** When implementing, prefer aligning new code to spec unless a deliberate MVP shortcut is documented here.

---

## 7. Naming Conventions

- **JavaScript** only — no TypeScript.
- Files: `camelCase.js` for utilities; `PascalCase.jsx` for React components.
- API routes: kebab-case paths (`invite-team-b`).
- MongoDB models: singular PascalCase (`Booking`, `User`).
- Constants: `SCREAMING_SNAKE_CASE` in `constants/`.
- Roles in DB: `snake_case` (`team_captain`, `stadium_owner`).

---

## 8. Configuration Files

| File | Purpose |
|------|---------|
| `server/.env` | Secrets, URIs, commission %, hold minutes |
| `client/.env` | `VITE_API_URL`, `VITE_SOCKET_URL` |
| `client/src/index.css` | Tailwind v4 `@theme` brand tokens |
| `server/.env.example` | Documented template (no secrets) |

---

## 9. Tests (Target)

```text
server/tests/
  unit/services/
  integration/api/
  concurrency/booking.test.js
  security/auth.test.js
```

Not yet present in MVP — add in Phase 10.
