# E-GAROON — Implementation Status

**Last updated:** August 2026  
**Short answer / Jawaab gaaban:**

> **Maya, ma aha dhammaan production.** Laakiin client + server hadda waa **isku xiran** Phase 2–9 core: booking, mock payments, slots, tournaments, lineups, owner revenue, admin settle, iyo cron jobs. WaafiPay/DahabPay dhabta ah, deploy AWS, tests, disputes, iyo audit logs weli waa Planned.

> **Not full production yet.** Client and server are **wired** for core SaaS: booking → pay → match pass → lineup; recurring bookings; discounts; owner tournaments + revenue; admin settle; live slot feed; scheduled hold expiry / settlement; site content CMS; Cloudinary uploads. Real WaafiPay/DahabPay, AWS deploy, dispute/refund module, audit logs, and test suite remain Planned.

---

## Legend

| Status | Meaning |
|--------|---------|
| **Done** | Implemented and wired to real backend API |
| **Partial** | Works with mock/stub or incomplete UX |
| **Planned** | Documented but not built |

---

## Team Captain

| Feature | Status | Where |
|---------|--------|-------|
| Register & login | Done | `/api/auth`, Login/Register; Google OAuth when server env is set |
| Public register role | Done | Default `team_captain`; `stadium_owner` only if SA `publicOwnerSignup` |
| Search + Bari booking UI | Done | `/search-fields?from=&to=&date=&types=&priceBand=&lat=&lng=` (+ `/book`) |
| Advanced stadium filters | Done | Price bands / min–max, format, GPS radius, sort, open now, facilities; service: `stadiumSearch.service.js` |
| Book slot + Team B invite | Done | `/api/bookings` |
| Mock payment + history | Partial | `/api/payments`, CaptainPayments |
| Match pass QR + receipt PNG/PDF | Done | Web `MatchPass` dual-side card + PNG download; mobile `MatchPassCard` + gallery save; `booking.matchPass` on GET booking when CONFIRMED+ |
| Pre-match sound reminders (30m×2, 5m) | Done | Mobile: Expo local notifications + haptics (`matchReminders.js`); Web: tab timers + Notification/Audio (optional) |
| Lineup / formation (payment-gated) | Done | Dual-captain boards + capacity-scoped formations + Cloudinary + BR-007 / lineupEnabled; mobile/web discovery: Kooxdayda (`GET /lineups/mine`) + Raadi koox kale |
| Tournaments register + fee | Done | `/api/tournaments`, CaptainTournaments |
| Messages / favorites | Partial | Placeholder UI |

---

## Stadium Owner

| Feature | Status | Where |
|---------|--------|-------|
| Register as stadium_owner | Partial | Public only when SA enables `publicOwnerSignup` (default off); else Owner onboarding |
| Stadium location, GPS lat/lng, images, hours | Done | OwnerStadiumForm |
| Fields (capacity, images, price/player, hours) | Done | OwnerStadiumDetail |
| Price calc (fee × players) | Done | OwnerStadiumDetail → Price calc |
| Block slots (rain/building) | Done | OwnerStadiumDetail → Block slots |
| Permanent weekly matches | Done | OwnerStadiumDetail → Permanent matches |
| Discounts on time slots | Done | OwnerStadiumDetail → Discounts |
| Tournaments / cups + slot block | Done | `/owner/tournaments` |
| Bookings + revenue | Done | `/owner/bookings` |
| Slot utilization / lost slots reports | Done | `GET /owner/reports/slots` + web OwnerReports + mobile Warbixin |
| Dhacay / lost empty hours (staff only) | Done | `GET /fields/:id/slots` hides `past` from captains; owner/manager/admin/SA see Dhacay + venue clock (web + mobile) |
| Near-real-time staff booking alerts | Done | `notifyStadiumStaff` + sockets `booking:created` / `match:started`; mobile toast (no Expo Go push) |
| Stadium manager (scoped invite) | Done | `StadiumManager` + Managers tab |
| Feature ideas 9–13 | Documented | `docs/18-owner-feature-ideas.md` |

---

## Admin / Super Admin

| Feature | Status | Where |
|---------|--------|-------|
| Users / stadium verify | Done | Admin pages |
| Bookings + settle / expire holds | Done | AdminBookings + payment routes |
| Auto settle cron | Done | `jobs/scheduler.js` |
| 4% commission | Done | pricing + settlement; SA `ownerCommissionVisible` (default OFF) hides cut from owners |
| Real WaafiPay / DahabPay | Partial | Adapter stubs + `PAYMENT_PROVIDER` |
| Site content CMS (hero, about team, contact intro) | Done | `SiteContent` + `/api/platform/content` + Super Admin editor |
| Policies (terms / privacy / owner agreement So+En) | Done | `SiteContent.policies` + Site Content → Policies tab |
| Super Admin register stadium owner | Done | `OwnerOnboarding` + agreement preview + A4 PDF + wizard + dual signatures + subscription activate |
| Public stadium owner signup toggle | Done | Platform Settings `publicOwnerSignup` (default **OFF**); `GET /auth/features` |
| Platform profit reports (view / PDF / Excel) | Done | `/super-admin/profit` + `GET /api/admin/reports/profit` (+ `/insights`, city/region filters, Top 10 + peak hours/weekdays) + `/export?format=pdf\|xlsx` |
| Free match gift campaigns | Done | SA `/super-admin/gifts` + `giftEnabled` master switch (default OFF) + `/api/gifts/*`; captain web Gift card suspense reveal + redeem; mobile Dheeraad |
| Weather / rain / match risks | Done | SA `weatherEnabled` (default OFF); tracked cities Hargeisa / Muqdisho / Burao / Borama (+ SA add); 30m refresh + `WEATHER_RISK` alerts; board on Platform Settings; banners on Home / Stadiums / Hoyga |
| Audit logs / disputes | Planned | — |

---

## Platform / Infra

| Item | Status |
|------|--------|
| Socket emits on booking/payment | Done |
| Cron: expire holds, complete match, settle | Done (`jobs/scheduler.js`) |
| Payment provider adapter pattern | Done (mock live; Waafi/Dahab stubs ready, credentials needed) |
| Cloudinary image uploads (stadiums, fields, teams) | Done (`cloudinary.service.js`) |
| OTP service | Done — Verify adapters (`otpProviders/`); gated by `OTP_ENABLED` (default false) |
| i18n locales (Somali + English) | Partial (`i18n/locales/` present; full rollout in progress) |
| Seed demo users | Done (`npm run seed`) |
| `/api/v1` versioning | Planned (still `/api`) |
| Unit/E2E tests + AWS deploy | Planned |

---

## Quick test

```bash
cd server && npm run seed && npm run dev
cd client && npm run dev
```

| Role | Email | Password |
|------|-------|----------|
| Captain | `captain@demo.kulansiiye` | `Demo1234!` |
| Owner | `owner@demo.kulansiiye` | `Demo1234!` |
| Admin | `admin@demo.kulansiiye` | `Demo1234!` |
| Super | `super@demo.kulansiiye` | `Demo1234!` |

**Flows:** `/search-fields?from=Hargeisa&date=23-08-2026` → VIEW SLOTS → hold → pay → lineup · Owner cups · Admin settle.
