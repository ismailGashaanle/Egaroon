# E-GAROON — API Contract

**Version:** 1.0  
**Base URL (target):** `/api/v1`  
**Base URL (current MVP):** `/api`  
**Format:** JSON  
**Auth:** Bearer access token; refresh via httpOnly cookie  
**Related:** [06-roles-permissions.md](./06-roles-permissions.md), [12-security-design.md](./12-security-design.md)

> **Note:** The MVP implements routes under `/api`. New endpoints should follow `/api/v1` when versioning is introduced. Below documents the **target contract**; current paths omit the `v1` segment.

---

## Conventions

| Item | Rule |
|------|------|
| Success | `{ "success": true, "data": ... }` or direct resource |
| Error | `{ "success": false, "message": "...", "code": "..." }` |
| Pagination | `?page=1&limit=20` → `{ data, meta: { page, limit, total } }` |
| IDs | MongoDB ObjectId strings |
| Dates | ISO 8601 UTC |
| Slot clock | Venue wall-clock HH:mm encoded as UTC clock hours (**no EAT offset**). Owner Friday `20:00`–`21:00` = `YYYY-MM-DDT20:00:00.000Z`–`T21:00:00.000Z` = the 8:00 PM–9:00 PM cell. Clients label with `startLabel`/`endLabel` or `getUTCHours()`, never device local time. |

---

## Health

### GET /api/v1/health

| | |
|---|---|
| **Auth** | None |
| **Response** | `{ "status": "ok", "timestamp": "..." }` |

---

## Auth — `/api/v1/auth`

### POST /register

| | |
|---|---|
| **Auth** | None |
| **Role** | — |
| **Body** | `{ email, password, name, role?: "team_captain" \| "stadium_owner", phone }` |
| **Validation** | Email unique, password min 8, Somali phone unique |
| **Response** | `201` `{ user, accessToken }` + refresh cookie |
| **Role rule** | Default `team_captain`. `stadium_owner` only when Super Admin enabled `publicOwnerSignup`; otherwise **403** `PUBLIC_OWNER_SIGNUP_DISABLED`. Admin / super_admin never accepted. |
| **Errors** | `409` duplicate, `400` validation, `403` public owner signup off |

### POST /login

| | |
|---|---|
| **Body** | `{ email, password }` or `{ phone, password }` |
| **Response** | `200` `{ user, accessToken }` + refresh cookie |
| **Note** | Google-only accounts (no `passwordHash`) get `401` `PASSWORD_NOT_SET` — use Continue with Google or Forgot password. |

### GET /oauth/google

| | |
|---|---|
| **Auth** | None |
| **Query** | `role=stadium_owner` (ignored unless `publicOwnerSignup` is on) |
| **Response** | `302` to Google consent |
| **Note** | Shown on the client only when `GET /features` has `oauthEnabled: true` (server `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`). |

### GET /oauth/google/callback

| | |
|---|---|
| **Auth** | None (Google redirect) |
| **Response** | `302` to `{CLIENT_URL}/oauth/callback?code=` (one-time, 90s) or `?error=` |

### POST /oauth/exchange

| | |
|---|---|
| **Auth** | None |
| **Body** | `{ code }` (from callback query) |
| **Response** | `200` `{ user, accessToken }` + refresh cookie |
| **Role rule** | Existing email keeps existing role. New Google users are `team_captain` unless public owner signup is on and register requested owner. |

### POST /refresh

| | |
|---|---|
| **Auth** | Refresh cookie |
| **Response** | `200` `{ accessToken }` |

### POST /logout

| | |
|---|---|
| **Auth** | Bearer |
| **Response** | `204` |

### GET /me

| | |
|---|---|
| **Auth** | Bearer |
| **Response** | `200` User object (no passwordHash) |

### GET /features

| | |
|---|---|
| **Auth** | None (public) |
| **Response** | `{ otpEnabled, lineupEnabled, giftEnabled, weatherEnabled, ownerCommissionVisible, publicOwnerSignup, oauthEnabled, oauthProviders }` |
| **Note** | `lineupEnabled`, `giftEnabled`, `weatherEnabled`, `ownerCommissionVisible`, and `publicOwnerSignup` come from Platform Settings (all default **false**). `oauthEnabled` is true only when Google client id + secret are set on the server. Clients hide owner signup / Google UI from these flags — never from Vite env. |

---

## Weather — `/api/v1/weather`

Play-risk for Super Admin–tracked cities (Hargeisa, Muqdisho, Burao, Borama + SA-added). Super Admin always allowed. Everyone else requires `weatherEnabled=true` (else **403** `WEATHER_DISABLED`).

### GET /

| | |
|---|---|
| **Auth** | Optional Bearer |
| **Query** | `date` (YYYY-MM-DD, default today), `city`, `region`, `q`, `lat`, `lng`, `stadiumId` |
| **Response** | `{ weather, weatherEnabled }` — `place`, `summary`, `play` (good/caution/poor/unplayable), `risks[]`, `hours[]`, `outlook[]` |
| **Notes** | Open-Meteo. Used for a stadium/date card. Redis cache ~20 min (forecast) / 7 days (historical). |

### GET /alerts

| | |
|---|---|
| **Auth** | Optional Bearer |
| **Query** | `date` (YYYY-MM-DD, default today in Africa/Mogadishu) |
| **Response** | `{ date, alerts[], cities[], weatherEnabled }` — `alerts` only caution/poor/unplayable |

### GET /cities

| | |
|---|---|
| **Auth** | Optional Bearer |
| **Response** | `{ cities[], weatherEnabled }` — active tracked cities + last play level / snapshot |

### POST /cities

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | super_admin |
| **Body** | `{ name, nameSo?, region? }` — geocoded in Somalia, then watched |
| **Response** | `201 { city }` |

### DELETE /cities/:id

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | super_admin |
| **Notes** | Soft-deactivate. Seeded defaults (Hargeisa, Muqdisho, Burao, Borama) cannot be removed. |

### POST /refresh

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | super_admin |
| **Response** | `{ cities[], date, alerts[] }` — pulls Open-Meteo for all active cities; notifies stadium staff on new risk (deduped) |

---

## Teams — `/api/v1/teams`

### POST /

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | team_captain |
| **Permission** | team.create |
| **Body** | `{ name, logoUrl? }` |
| **Response** | `201` Team (status: draft) |

### GET /

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | team_captain |
| **Response** | `200` `[Team]` (own teams) |

### GET /:teamId

| | |
|---|---|
| **Auth** | Optional (public read for invite lookup) |
| **Response** | `200` Team with captain name |

### PATCH /:teamId

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | team_captain (owner) |
| **Body** | `{ name?, logoUrl? }` |

### DELETE /:teamId

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | team_captain (owner) |

### POST /:teamId/players

| | |
|---|---|
| **Body** | `{ displayName, jerseyNumber? }` |

### DELETE /:teamId/players/:playerId

---

## Stadiums — `/api/v1/stadiums`

### GET /

| | |
|---|---|
| **Auth** | Optional |
| **Query** | `city?`, `region?`, `area?`, `q?` / `search?` (name/city/area/region soft match), `mine?`, `status?` (staff), `lat?`, `lng?`, `radiusKm?` (default 20; nearby browse — not `maxMatchDistanceKm`), `minPrice?`, `maxPrice?`, `priceBand=low\|mid\|high`, `type?` / `types?` (comma: `5v5`…`11v11`), `facilities?` (comma), `openNow?` (within stadium opening–closing clock), `availableNow?` / `haddaBanaan?` (≥1 bookable hourly slot starting within ~3h; excludes stadium/field offline ops), `sort=nearest\|price_asc\|price_desc\|rating\|newest` |
| **Response** | `{ stadiums, meta }` — each stadium may include `startingPrice` (USD one-team share, min across its fields), `fieldCount`, `fieldTypes`, `sizePrices: [{ type: "5v5"\|"7v7"\|…, price, count }]` (min price + field count **per size**, derived from active fields), `distanceKm`, `ops`. `meta.priceBands`: dynamic P33/P66 from active fields when sample ≥6, else defaults low≤20 / mid≤40 USD. `meta.availableNowLookaheadHours` when relevant. `meta.applied` echoes filters including `q`, `openNow`, `availableNow`, `hasGeo`. |

### GET /:stadiumId

Public stadium detail + fields summary.

### POST /

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | stadium_owner |
| **Body** | `{ name, description, city, region, location?, images?, facilities? }` |

### PATCH /:stadiumId

Owner or admin.

### DELETE /:stadiumId

Owner only.

### POST /:stadiumId/verify

| | |
|---|---|
| **Role** | admin, super_admin |
| **Response** | Stadium `verified: true` |

### GET /:stadiumId/fields

List fields for stadium.

### POST /:stadiumId/fields

| | |
|---|---|
| **Role** | stadium_owner |
| **Body** | `{ name, type, capacity, pricingMode, pricePerPlayer?, fixedPrice?, workingHours? }` |

---

## Fields — `/api/v1/fields`

### GET /:fieldId

Field detail.

### PATCH /:fieldId

Owner of parent stadium.

### DELETE /:fieldId

Owner of parent stadium.

### GET /:fieldId/slots

Auth optional. Lost empty hours (`state: past`, Somali **Dhacay**) are included only when the caller is `stadium_owner`, `stadium_manager`, `admin`, or `super_admin`. Team captains and anonymous callers never receive past empty hours — those hours cannot be booked.

| | |
|---|---|
| **Query** | `date=YYYY-MM-DD` (venue calendar day) |
| **Response** | `{ fieldId, date, openingTime, closingTime, clock, includeLostSlots, lostCount?, paymentPolicy, slots: [{ startTime, endTime, startLabel, endLabel, state, lost, reason, labelHint, labelSo, teamName, isRecurring, pricing, … }] }` |
| **Clock** | `clock` is stadium wall-clock now (`Africa/Mogadishu`): `{ tz, venueNow, date, time, timeLabel }`. Past vs bookable uses this clock, not the device timezone. `startLabel`/`endLabel` are venue `HH:mm`. Occupied past hours stay `booked` / `selected` / Joogto / `blocked` — **lost** is only an empty hour whose start has already passed. Joogto `20:00` → `state: booked`, `labelHint: RECURRING`, `labelSo: "Joogto · {team}"`. |

### GET /:fieldId/availability

| | |
|---|---|
| **Query** | `date=YYYY-MM-DD` or `from&to` |
| **Response** | `{ slots: [{ start, end, status, price? }] }` |

### POST /:fieldId/availability

Create block (owner/manager).

| **Body** | `{ startTime, endTime, reason, note? }` |

### DELETE /availability-blocks/:blockId

Remove block (stadium owner or assigned manager).

### PATCH /availability-blocks/:blockId

Update block type, time range, or reason (stadium owner or assigned manager).

| **Body** | `{ type?, startsAt?, endsAt?, reason? }` |

### GET /stadiums/:stadiumId/availability-blocks

List blocks for a stadium (owner or assigned manager).

| **Query** | `fieldId?`, `upcoming=1` (default), `from&to` |
| **Response** | `{ blocks: [...] }` populated with field + createdBy. Includes `scope: 'stadium'` whole-stadium locks. |

### POST /stadiums/:stadiumId/lock

Lock the **whole stadium** (all fields) for a time range — no public booking. Owner or assigned manager.

| **Body** | `{ type?, startsAt, endsAt, reason? }` |
| **type** | `owner_block` (default), `weather`, `maintenance`, `holiday`, `private_event`, `tournament` |
| **Response** | `201` `{ block }` with `scope: 'stadium'` |

Fails with 409 if live bookings exist in the range, or an overlapping stadium lock already exists.

### POST /stadiums/:stadiumId/ops

Owner/manager online/offline for public booking (manual or scheduled window).

| **Body** | `{ mode: "online"\|"offline", offlineFrom?, offlineUntil?, reason? }` or `{ isOnline, offlineFrom?, offlineUntil?, offlineReason? }` |
| **Response** | `200` `{ stadium }` — stadium JSON includes `ops` (`bookable`, `messageSo`, `messageEn`, `reopenAt`, `secondsUntilReopen`) |
| **Booking** | `POST /bookings` and walk-in reject with `409` `STADIUM_OFFLINE` when not bookable |

Stadium list/detail responses attach `ops` via the same helper.

### POST /fields/:fieldId/ops

Owner/manager online/offline for **one field** (same body shape as stadium ops). Does not close other fields or other stadiums.

| | |
|---|---|
| **Role** | stadium_owner or assigned stadium_manager |
| **Body** | `{ mode: "online"\|"offline", offlineFrom?, offlineUntil?, reason? }` or `{ isOnline, offlineFrom?, offlineUntil?, offlineReason? }` |
| **Response** | `200` `{ field }` — field JSON includes `ops` (`bookable`, `messageSo`, `messageEn`, `reopenAt`, `secondsUntilReopen`, `scope: "field"`) |
| **Booking** | Hold + walk-in reject with `409` `FIELD_OFFLINE` when that field is offline (after stadium check) |

Field list/detail (`GET /stadiums/:id/fields`, `GET /fields/:id`) attach `ops` the same way.

---

## Bookings — `/api/v1/bookings`

### POST /

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | team_captain |
| **Permission** | booking.create |
| **Body** | `{ fieldId, teamId, startTime, endTime, playerCount }` |
| **Preconditions** | Slot available, team owned by captain |
| **Response** | `201` Booking (`status: HELD`, `holdExpiresAt`) |
| **Errors** | `409` conflict / `STADIUM_OFFLINE` / `FIELD_OFFLINE`, `403` blocked slot |

### GET /

Own bookings (captain) or field bookings (owner filter).

### GET /:bookingId

| | |
|---|---|
| **Auth** | Bearer · team_captain |
| **Response** | `{ booking }` — populated field/stadium/teams/captains. When status is **CONFIRMED+** (both paid or full cover): includes `bookingCode`, `qrPayload` (gate QR), `qrValidFrom` / `qrValidUntil` / `qrValidNow`, and **`matchPass`** card payload (both sides). Before confirm: `bookingCode` / `qrPayload` / `matchPass` omitted. |
| **`matchPass`** | `{ bookingId, bookingCode, matchCode, qrPayload, bookedAt, startTime, endTime, stadiumName, fieldName, coveredFullMatch, status, currency, totalPrice, teamA, teamB }`. Each side: `captainName`, `captainPhone`, `payerPhone` / `payerPhoneDisplay` (lambarka lacagta), `paidAt`, `paymentMethod` / `paymentMethodLabel` (cash/zaad/edahab/hormuud/…), `amountPaid`, `reference`. Same `qrPayload` as owner/manager ScanScreen. |

### POST /:bookingId/invite-team-b

| | |
|---|---|
| **Body** | `{ teamBId }` or `{ phone }` (Somali MSISDN) |
| **Response** | Booking with Team B attached; inherits open Match Code / opponent window if already started |

### GET /match-code/:code

| | |
|---|---|
| **Auth** | Bearer team_captain |
| **Params** | Match Code `SG-XXXX-XXXX` |
| **Query** | `teamAPhone` (required) — Somali MSISDN used when Team A paid |
| **Response** | Sanitized preview: Team A paid, Team B amount due, field/slot, `opponentWindow` countdown. **No** `bookingCode` / QR / Team A phone |
| **Errors** | `404` `MATCH_CODE_NOT_FOUND` (*Ma jiro code-kani*) or `TEAM_A_PHONE_MISMATCH` (*Lambarka lacagta laga diray waa khalad*); `400` `MATCH_JOIN_LOCKOUT` after repeated fails; `403` if `invitePhone` locked. Preview may include `paymentProgress` |

### POST /join-by-code

| | |
|---|---|
| **Auth** | Bearer team_captain |
| **Body** | `{ matchCode, teamAPhone, teamId? }` — `teamAPhone` required (normalized Somali) |
| **Response** | Booking with requester as Team B; `amountDue`; window metadata |
| **Errors** | Same anti-scam rules as preview; `409` window expired / Team B already joined / own booking |

### POST /:bookingId/lock-invite-phone

| | |
|---|---|
| **Auth** | Bearer team_captain (Team A only) |
| **Body** | `{ invitePhone }` Somali MSISDN |
| **Effect** | Locks Match Code join to that Team B account phone until Team B joins |
| **Note** | `invite-team-b` by phone also sets `invitePhone` when Match Code exists |

### POST /:bookingId/cancel

Captain (Team A/B) or admin per rules.

### POST /:bookingId/check-in

| | |
|---|---|
| **Body** | `{ teamSide: "A" \| "B", qrToken? }` |
| **Response** | Booking `CHECKED_IN` |

### GET /:bookingId/lineups

| | |
|---|---|
| **Auth** | Bearer (team_captain of Team A or B on this booking) |
| **Preconditions** | `lineupEnabled=true` (platform setting, default **false**) **and** BR-007; booking must not be ended (BR-007d) |
| **Response** | `{ lineups[], capacity, fieldType?, fieldName? }` — up to one lineup doc **per team** (Team A and/or Team B). Both captains receive **both** boards. |

### PUT /:bookingId/lineup

| | |
|---|---|
| **Auth** | Bearer (team_captain of Team A or B on this booking) |
| **Preconditions** | `lineupEnabled=true` **and** BR-007; booking not ended (BR-007d); starter count = field capacity |
| **Body** | `{ formation: string, players: [{ displayName, jerseyNumber?, position?, formationSlot?, status: "starter"\|"bench", photoUrl?, injured?, injuryNote? }], published?: boolean }` |
| **Rules** | Upserts **only the caller’s team** side (unique `(booking, team)`). Injured → `bench`. Exactly `capacity` starters with unique `formationSlot` matching the formation. Formation key must be valid for that capacity. Every player needs a non-empty `displayName` (no invented defaults). `photoUrl` must be http(s) (Cloudinary via `POST /api/uploads`, folder `lineups`) — base64 / blob rejected. Bench soft-capped. `published` defaults **true** (publish-on-save). |
| **Response** | `{ lineup }` — Socket.IO `lineup:updated` emitted to `booking:{id}` with all boards for the booking |
| **Note** | After Team A **split** pay, booking includes `matchCode`, `opponentWindow`, `messageSo`. `coverFullMatch: true` skips Match Code window. |

---

## Lineups (discovery) — `/api/lineups`

Requires platform `lineupEnabled=true`. Public search/team endpoints have no payment gate and only return lineups with `published !== false` whose booking is still live (not ended — BR-007d; stale docs are hard-deleted by the scheduler).

### GET /mine

| | |
|---|---|
| **Auth** | Bearer (any authenticated role) |
| **Query** | `limit?` (default 20, max 40) |
| **Response** | `{ results: [public lineup shape…], teams: [{ _id, name, logoUrl }], query: "mine" }` |
| **Note** | Latest lineup **per team** the caller captains (includes unpublished — owner view). Users with no teams get empty `results` / `teams` (e.g. owners/managers browsing only via search). |

### GET /search?q=teamName

| | |
|---|---|
| **Auth** | None (public) |
| **Query** | `q` (min 2 chars), `limit?` (default 12, max 30) |
| **Response** | `{ results: [{ id, team: { _id, name, logoUrl }, formation, capacity, published, updatedAt, bookingId, starters[], bench[], players[] }], query }` |
| **Note** | Matches teams by name (case-insensitive); each result is that team's **latest** published lineup. Teams without a published lineup are omitted. |

### GET /teams/:teamId

| | |
|---|---|
| **Auth** | None (public) |
| **Response** | `{ lineup }` — same public shape as a search result item |
| **Errors** | `404` if team missing or no published lineup |

---

## Payments — `/api/v1/payments`

### POST /

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | team_captain |
| **Body** | `{ bookingId, teamId?, side?: "teamA"\|"teamB", carrierId\|operator, phone\|payerPhone, payerName?, coverFullMatch?: boolean, idempotencyKey?, invitePhoneTeamB?, teamBContactPhone?, teamBContactName? }` |
| **Response** | `201` `{ payment, checkout, payerRegistered?, warning? }` |
| **Validation** | Strict whitelist — unexpected fields rejected. Client `amount` / `totalPrice` / discounts **rejected** (server pricing only). `payerName` Somali-safe letters/spaces (2–80). Phones via `normalizeSomaliPhone` + carrier match. Optional `invitePhoneTeamB` (Team A split) locks `invitePhone` after Match Code is created. Rate-limited. |
| **Note** | Amount is always server-calculated from booking pricing. `coverFullMatch: true` (Team A only) charges `pricing.totalPrice` (both shares); on success sets `coveredFullMatch` and confirms the booking without Team B payment. Share links for Team B: `code` + `teamAPhone` only (no tokens). |

### GET /:paymentId

Own payment or admin.

### POST /webhook

| | |
|---|---|
| **Auth** | Provider signature (not JWT) |
| **Headers** | Provider-specific signature header |
| **Body** | Raw provider payload |
| **Response** | `200` (idempotent) |

### POST /:paymentId/mock-confirm (dev only)

Simulates webhook; disabled in production.

### POST /bookings/:bookingId/settle

| | |
|---|---|
| **Role** | admin, super_admin |
| **Response** | Settlement breakdown |

### GET /owner/bookings

Owner/manager booking list + search cards.

| | |
|---|---|
| **Auth** | Bearer · stadium_owner \| stadium_manager |
| **Query** | `date` (YYYY-MM-DD), `time` (HH:mm), `from` / `to`, `name`, `phone`, `q` / `search`, `bookingCode`, `stadiumId`, `status`, `limit` |
| **Response** | `{ bookings, cards, count }` — each `cards[]` item is a faafaahin payload: captain name/phone, carrier, bookedAt, paymentMethod, paidAt, amountPaid, reference/tixraac, walkIn, qrPayload, `qrVerified`, `canStart`, `canStartMatch`, `timeState`, lock messages. Booking `commissionAmount` / `commissionPercent` are nulled unless `ownerCommissionVisible`. |

### GET /owner/revenue

Owner/manager settled payout summary.

| | |
|---|---|
| **Auth** | Bearer · stadium_owner \| stadium_manager |
| **Response** | `{ revenue: { settledCount, totalPayout, totalCommission, upcomingBookings, stadiums } }` |
| **Note** | `totalPayout` is null for managers. `totalCommission` is null for managers and for owners unless Super Admin sets `ownerCommissionVisible=true`. Payout (net) is unchanged. |

### GET /owner/reports

Owner/manager summary report (bookings by day/hour/field, captains, revenue for owners).

| | |
|---|---|
| **Auth** | Bearer · stadium_owner \| stadium_manager |
| **Query** | `stadiumId?`, `days?` (1–365, default 14), `from?`, `to?` |
| **Scope** | Owner: owned (+ managed) stadiums. Manager: assigned stadium(s) only. Revenue fields null for managers. `commissionTotal` is also null unless Super Admin sets `ownerCommissionVisible=true` (owners only). |

### GET /owner/reports/slots

Slot utilization + lost inventory + booking history for the same scope.

| | |
|---|---|
| **Auth** | Bearer · stadium_owner \| stadium_manager |
| **Query** | `stadiumId?`, `days?` (1–90, default 14), `from?`, `to?` |
| **Response** | `{ report }` with `totals` (`bookedSlots`, `pastBookedSlots`, `availableRemaining`, `lostSlots`, `heldSlots`, `blockedSlots`, `utilizationPercent`, `unbookedDayCount`), `byDay`, `byField`, `unbookedDays`, `lostExamples`, `bookingHistory`, `definitions` |
| **Metrics** | **Lost slots** = past open hours with no CONFIRMED+ booking (empty / expired hold; blocks excluded). **Utilization** = `pastBookedSlots / (pastBookedSlots + lostSlots) × 100`. **Unbooked days** = field-days where every past bookable slot was empty. |
| **Realtime** | Related staff alerts: Socket `booking:created` / `booking:confirmed` / `match:started` + persisted `Notification` (`BOOKING_HELD`, `PAYMENT_RECEIVED`, `MATCH_STARTED`) via `user:{id}` and optional `stadium:{id}` rooms. |

### GET /owner/bookings/:bookingId

Owner/manager booking detail + gateSummary + detailCard.

| | |
|---|---|
| **Auth** | Bearer · stadium_owner \| stadium_manager |
| **Response** | `{ booking, gateSummary, detailCard }` — `detailCard` mirrors list card fields + QR payload for staff verification |

### POST /owner/check-in

Owner or stadium manager gate scan.

| **Body** | `{ stadiumId` **required**, `bookingCode?`, `qrPayload?`, `validateOnly?`, `force?` }` |
| **Rules** | Booking must belong to `stadiumId`. Start only from ~10 min before slot start until `endTime` (`timeState`: too_early / ok / late / expired). Wrong stadium → 409. |
| **Bilow gate** | `validateOnly: true` marks session `qrVerified`. Non-validate start requires QR validated + time OK. Response includes `qrVerified`, `canStartMatch`, `lockReason`, `lockMessageSo` / `lockMessageEn`, `detailCard`. |

### POST /owner/walk-in

Walk-in booking at the venue (owner/manager).

| **Body** | `{ stadiumId, fieldId, startTime, endTime, captainPhone, captainName?, teamName?, payMode: full\|half_a\|cash_full, paymentMethod?: cash\|zaad\|edahab\|hormuud, payerPhone?, payNow? }` |
| **Response** | `201` `{ booking, payment, payMode, paymentMethod, walkIn, gateSummary, detailCard, captain }` |
| **Errors** | `409` if stadium `ops.bookable` is false (`STADIUM_OFFLINE`) or field `ops.bookable` is false (`FIELD_OFFLINE`) |

### GET /owner/recurring

List permanent weekly matches for stadiums the caller owns or manages.

| | |
|---|---|
| **Auth** | Bearer · stadium_owner \| stadium_manager |
| **Query** | `stadiumId?`, `fieldId?` |
| **Response** | `{ recurring: [{ _id, field, stadium, teamName, frequency, dayOfWeek, startTimeLocal, endTimeLocal, startDate, endDate, status, note }] }` |

### POST /owner/recurring

Create a permanent weekly match that locks that weekday/time on the field forever (until edited or deleted). Captains cannot book the slot.

| **Body** | `{ fieldId, teamName, dayOfWeek (0=Sun…6=Sat), startTimeLocal, endTimeLocal, frequency?: weekly\|biweekly\|monthly, startDate?, endDate?, note?, teamId? }` |
| **Response** | `201` `{ recurring }` |
| **Errors** | `409` `RECURRING_OVERLAP` if the same field already has an active weekly match on that weekday/time |

### PATCH /owner/recurring/:recurringId

Update team name, field, weekday, times, dates, note, or status (`active` \| `paused` \| `ended`). Owner or assigned manager of the stadium.

| **Body** | Same fields as create (partial). `fieldId?` to move to another field the caller manages. |
| **Response** | `{ recurring }` |

### DELETE /owner/recurring/:recurringId

Remove the weekly match. That weekday/time becomes bookable again (unless another block/booking applies).

---

## Owner / Manager gate — `/api/owner` (MVP)

Owner and assigned stadium managers share these routes (`requireRole`: `stadium_owner` | `stadium_manager`).

### POST /check-in

| | |
|---|---|
| **Auth** | Bearer |
| **Role** | stadium_owner, stadium_manager |
| **Body** | `{ bookingCode? , qrPayload? , force?: boolean, validateOnly?: boolean }` |
| **QR payload** | Match pass JSON: `{ v, code, bookingId, expiresAt }` or plain `KUL-…` code |
| **Rules** | Booking must be `CONFIRMED` / `CHECKED_IN` / `IN_PROGRESS`. Payment is implied by `CONFIRMED`. Stadium access required. |
| **Slot time** | Compare **now** to booked hour `startTime`–`endTime`. `timeState`: `too_early` (now &lt; start) · `ok` (within slot + within grace) · `late` (past grace, still ≤ end) · `expired` (now &gt; end). |
| **Start gate** | Non-`validateOnly` start allowed only for `ok` \| `late`. `too_early` and `expired` **reject** start (409) unless `force` in **dev/non-production**. |
| **validateOnly** | Same booking/access checks + `gateSummary` + time fields — **no** status mutation. Returns success even when `too_early` / `expired` so the client can show waiting / expired UI. |
| **Success (start)** | Sets `gateCheckedInAt`, status → `IN_PROGRESS` (starts the match). Idempotent if already gated. |
| **Response** | `{ booking, gateSummary, detailCard?, alreadyCheckedIn, forcedOutsideWindow?, validateOnly?, qrVerified, canStartMatch, lockReason?, lockMessageEn?, lockMessageSo?, timeState, canStart, startsAt, endsAt, secondsUntilStart, secondsUntilEnd, messageEn, messageSo }` — time + lock fields also mirrored on `gateSummary` / `detailCard`. |
| **Late (15 min)** | `gateSummary.late` uses platform `noShowGraceMinutes` (default 15). Advisory — gate **still allows** start until slot `endTime`. After `endTime`, `expired` blocks. `force` outside window is **dev/non-production only**. |
| **Reject details** | On start reject for time, `error.details` includes `{ timeState, canStart, qrVerified, canStartMatch, lockReason, lockMessageEn, lockMessageSo, startsAt, endsAt, secondsUntilStart, secondsUntilEnd, messageEn, messageSo }`. |
| **Gaps** | Automated `NO_SHOW_REVIEW` after grace is not implemented yet (docs Phase). |

---

## Payouts — `/api/v1/payouts` (planned)

### GET /

Owner: own payouts. Admin: all.

### POST /:payoutId/process

Super Admin / system job.

---

## Tournaments — `/api/v1/tournaments` (planned)

### POST /

Owner creates tournament.

### GET /

Browse public tournaments.

### POST /:id/register

Captain registers team + payment.

### POST /:id/fixtures/generate

Owner/admin.

### PATCH /fixtures/:fixtureId/result

Record score.

---

## Admin — `/api/v1/admin`

### GET /users

| **Role** | admin, super_admin |
| **Query** | `role`, `status`, `search`, `includeDeleted` |

### PATCH /users/:userId

Safe profile fields only: `name`, `phone`, `city`, `region`, `area`. No password/email changes.

### PATCH /users/:userId/status

`{ status: "active" | "suspended" }` — suspend = block; active = unblock. Bumps `tokenVersion`.

### DELETE /users/:userId

Soft-delete (`deletedAt`); forces suspend. Cannot delete Super Admin or self.

### POST /users/:userId/restore

| **Role** | super_admin only |

### PATCH /users/:userId/role

| **Role** | super_admin only |
| **Body** | `{ role }` — cannot assign `super_admin` via this endpoint |

### GET/PATCH /settings

| **Role** | super_admin only |
| **Fields** | `platformCommissionPercent`, `ownerCommissionVisible` (default **false** — hide commission from stadium owners), `weatherEnabled` (default **false** — city play-risk alerts for Hargeisa / Muqdisho / Burao / Borama + SA-added cities), field subscription, `bookingHoldMinutes`, `teamBPriorityMinutes`, `teamBGraceMinutes`, `teamBMaxGraceExtensions`, `teamBFinalGraceMinutes`, `slotDemandTtlSeconds`, refund/credit flags, payout delay, lineup, gifts, support contacts |

### GET /reports/profit

| **Role** | super_admin only |
| **Query** | `period=day\|week\|month\|quarter\|semiannual\|year\|custom`, optional `from`, `to` (YYYY-MM-DD; required when `period=custom`), optional `city`, `region` (exact match on stadium geo) |
| **Returns** | `{ report }` with `period`, `from`, `to`, `spanDays`, `generatedAt`, `currency`, `policy`, `geo`, `geoOptions`, `totals` (commission + subscription paid = profit), `commissionSources`, `inventory`, `series`, `byStadium`, `byField`, `insights` (top10 by commission, peakHours 0–23, peakWeekdays) |
| **UI** | Super Admin `/super-admin/profit` — dashboard + filters + Top 10 + peak charts + **View report** (Print / PDF / Excel) |

### GET /reports/profit/insights

| **Role** | super_admin only |
| **Query** | Same as profit report (`period`, `from`, `to`, `city`, `region`) |
| **Returns** | `{ insights }` — `topStadiumsByCommission` (max 10), `peakHours`, `peakWeekdays`, filtered `totals`, `definitions` |
| **Peak definition** | Commission by **match slot `startTime`** hour/weekday (not settlement time) |

### GET /reports/planner

| **Role** | super_admin only |
| **Query** | Same period + geo filters as profit report |
| **Returns** | `{ plan }` with `baseline` (inventory per-field prices, policy, actuals, observed occupancy), default `scenario`, `projection` (GMV / commission / owner payout / subscription / profit / byBand / by field), `comparison`, `insights` |
| **UI** | Super Admin `/super-admin/planner` |

### POST /reports/planner

| **Role** | super_admin only |
| **Body** | `{ period, from, to, city, region, scenario }` |
| **scenario** | `days`, `occupancyPct` or `occupancyByBand`, `multipliers` (morning/afternoon/evening/night vs each field’s own base), `commissionPercent`, `subscriptionEnabled`, `subscriptionAmount`, `extraFields`, `extraStadiums`, `extraFieldBasePrice`, `formula` (BODMAS) |
| **Note** | Planning only. Does not write Field prices or Platform Settings. Commission math uses `pricing.service` `calculateCommission`. |

### GET /reports/profit/export

| **Role** | super_admin only |
| **Query** | Same period + geo filters as above + `format=xlsx\|pdf` |
| **Returns** | Attachment (`Content-Disposition: attachment`) |
| **PDF** | A4 designed report: E-Garoon header, title “Platform Profit Report”, period/range, generated-at, summary cards, time-series / by-stadium / by-field tables, page numbers + confidential footer |
| **Excel** | Workbook sheets: **Summary** (merged title, policy meta, currency-formatted totals), **Time series**, **By stadium**, **By field** — branded header rows, number formats, TOTAL rows |

### POST /reports/commission/backfill

Persist missing `commissionAmount` on eligible historical bookings.

### GET /subscriptions · PATCH /subscriptions/:periodId

Field subscription periods; mark paid/waived (manual collection).

### Free match gifts — `/api/gifts`

| Method | Path | Role | Notes |
|--------|------|------|--------|
| GET | `/gifts/campaigns` | super_admin | List campaigns (allowed even when `giftEnabled=false`) |
| POST | `/gifts/campaigns` | super_admin | Create (`name`, `city?`, `region?`, `startsAt?`, `endsAt`, `maxWinners`, `winRatePercent`, `notes?`) |
| POST | `/gifts/campaigns/:id/end` | super_admin | End campaign |
| POST | `/gifts/campaigns/:id/activate` | super_admin | Activate draft |
| GET | `/gifts/active` | team_captain | Active campaigns for captain geo (empty when `giftEnabled=false`) |
| POST | `/gifts/campaigns/:id/enter` | team_captain | Instant lottery; 1 entry/user; **403** if `giftEnabled=false`; returns `won` + voucher when issued |
| GET | `/gifts/vouchers/mine` | team_captain | Issued/redeemed vouchers (empty when `giftEnabled=false`) |
| POST | `/gifts/vouchers/preview` | team_captain | Validate code without redeeming (**403** if off) |
| POST | `/gifts/bookings/:bookingId/redeem` | team_captain | Apply 100% voucher → confirm booking at $0 (**403** if off) |

**Platform flag:** `giftEnabled` (default **false**, BR-009c) via Platform Settings / Gifts master switch; exposed on `GET /auth/features`.

**UI:** Super Admin `/super-admin/gifts` (master toggle + campaigns); captain dashboard Gift card with ~3s suspense reveal; booking details redeem; mobile Dheeraad Gift section.

### Admin user provision — `POST /api/admin/users` (super_admin only)

Create **admin** or **stadium_owner** accounts (not `super_admin`). Public self-register cannot create admin.

| Body | Notes |
|------|--------|
| `role` | `admin` \| `stadium_owner` (required) |
| `name`, `email` | Required |
| `phone`, `city`, `region` | Optional (phone normalized Somali) |
| `password` | Optional (≥8); auto-generated if omitted |

**Response (201):** `{ user, temporaryPassword }` — password returned **once**; `mustChangePassword=true`.

**UI:** Super Admin → Users → Register Admin / Register Stadium Owner. Full stadium+agreement flow remains under Register owners onboarding.

### Admin payments review — `/api/admin/payments`

| Method | Path | Role | Notes |
|--------|------|------|--------|
| GET | `/admin/payments` | admin, super_admin | List captain payments (`status`, `reviewStatus`) |
| PATCH | `/admin/payments/:paymentId/review` | admin, super_admin | `{ status: ok\|flagged\|pending, note? }` — review only, no amount change |

### Owner onboarding — `/api/admin/owner-onboardings` (super_admin only)

Register stadium owners with stadium + fields + dual signatures + subscription confirm.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/owner-onboardings` | List (`status`, `q`) |
| GET | `/owner-onboardings/suggest-email` | `?name=&phone=` → unique `@owners.kulansiiye.com` |
| GET | `/owner-onboardings/agreement-pdf` | Soft A4 **template** PDF (`?lang=so\|en`) from live Site Content `ownerAgreement` |
| POST | `/owner-onboardings` | Create draft |
| GET | `/owner-onboardings/:id` | Detail |
| GET | `/owner-onboardings/:id/agreement-pdf` | Soft A4 **filled** PDF (`?lang=so\|en`) — parties, stadium, field count, snapshots, signature images when present |
| PATCH | `/owner-onboardings/:id` | Update draft / subscription notes |
| POST | `/owner-onboardings/:id/submit-agreement` | Freeze policies → `awaiting_signatures` |
| POST | `/owner-onboardings/:id/signatures` | `{ superAdminSignatureUrl, ownerSignatureUrl }` → `subscription_pending` when both set |
| POST | `/owner-onboardings/:id/activate` | Confirm subscription + provision user/stadium/fields; returns `temporaryPassword` **once** |
| POST | `/owner-onboardings/:id/cancel` | Cancel non-active draft |

Statuses: `draft` → `awaiting_signatures` → `subscription_pending` → `active` \| `cancelled`.

UX: Super Admin **previews** the owner agreement (So/En) before the registration wizard; download/print template PDF, then continue to form. Field count on the Fields step syncs with `fields[]` and is printed on the filled PDF.

Site Content `policies.terms` / `policies.privacy` / `policies.ownerAgreement` (So/En/Ar) editable via existing `PATCH /admin/site-content`.

### POST /auth/password/change (authenticated)

`{ currentPassword?, newPassword }` — required after Super Admin provisioning when `mustChangePassword` is true.

### GET /audit-logs

Paginated audit trail (planned).

---

## Super Admin — `/api/v1/super-admin` (planned alias)

MVP uses `/api/admin/*` with `requireRole(super_admin)` for settings, profit, subscriptions, and owner onboarding. Alias under `/super-admin` remains optional.

---

## Webhooks — `/api/v1/webhooks`

| Route | Provider |
|-------|----------|
| POST /payments/waafipay | WaafiPay |
| POST /payments/dahabpay | DahabPay |

All webhooks: verify signature, idempotent, audit log.

---

## Socket.IO Events

| Event | Direction | Payload sketch |
|-------|-----------|----------------|
| `booking:updated` | server → client | `{ bookingId, status, ... }` |
| `payment:received` | server → client | `{ bookingId, teamId, amount }` |
| `availability:changed` | server → client | `{ fieldId, date }` |

Client emits: `join:field`, `join:booking` with auth.

---

## Rate Limits (target)

| Route group | Limit |
|-------------|-------|
| Auth login/register | 10/min per IP |
| Booking create | 5/min per user |
| Payment create | 10/min per user |
| General API | 100/min per user |

---

## MVP Route Mapping

Current MVP routes match the above without `/v1` prefix. See `server/README.md` for the exact implemented list.
