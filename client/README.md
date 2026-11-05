# kulansiiye — client

React frontend for **E-Garoon** — book football fields, build your team, and compete.

## Tech stack

- React 19 + Vite
- Redux Toolkit + React Redux (auth, teams, stadiums, bookings, UI/theme state)
- React Router v7 (public site, auth, and role-based dashboards)
- Tailwind CSS v4 (CSS-first theme — brand palette defined in `src/index.css`)
- Socket.IO client (real-time booking/availability updates)
- Axios (with an access/refresh-token interceptor)
- Framer Motion (page transitions, hover/tap micro-interactions)
- react-hot-toast (notifications)
- react-icons (Font Awesome icon set)
- qrcode.react (digital match pass QR code)

## Getting started

```bash
cd client
npm install
cp .env.example .env   # point at your running server (see ../server)
npm run dev
```

Requires the [`server`](../server) API running on `http://localhost:5000` for anything beyond the landing page shell — search, booking, auth, etc. all call the backend.

By default `VITE_API_URL` is `/api`. Vite proxies `/api` and `/socket.io` to the server so local development stays same-origin (no CORS setup). Set those env vars to full URLs when the API is on another host.

## Brand system

Defined as CSS custom properties in `src/index.css` under `@theme`, so every color is a first-class Tailwind utility (`bg-forest`, `text-charcoal`, `dark:bg-dark-surface`, etc.):

| Token | Hex | Usage |
|---|---|---|
| `forest` | `#176B45` | Primary buttons, links, active nav, logo |
| `olive` | `#6B8E3A` | Secondary accents, availability/verified states |
| `accent` | `#D98A3A` | Ratings, small attention states — used sparingly |
| `warmwhite` / `surface` | `#F7F6F1` / `#FFFFFF` | Backgrounds / cards |
| `charcoal` / `muted` | `#18201C` / `#59635D` | Primary / secondary text |
| `border` / `disabled` | `#E2E5DF` / `#A5ADA7` | Borders, disabled states |

Dark mode uses a `.dark` class on `<html>` (toggled via the `ui` Redux slice + `useTheme` hook, persisted to `localStorage`) with its own `dark-*` token set (`#142019` background, `#3A9B6A` primary, etc.) — never a generic blue/purple dark theme.

Status badges (`Badge` + `lib/statusStyles.js`) map every booking/payment/account status into just 4 muted semantic groups — confirmed / pending / cancelled / info — instead of a different bright color per status.

## Folder structure

```text
src/
  app/store.js            Redux store
  api/                    axios client + one module per resource (auth, teams, stadiums, bookings, payments, admin)
  features/               Redux slices (auth, ui, teams, stadiums, bookings)
  hooks/                  useAuth, useSocket, useTheme
  lib/                    roles, status-style mapping, socket.io singleton
  components/
    common/                Button, Card, Badge, Input, Select, Modal, Spinner, EmptyState, PageTransition, ThemeToggle, Logo, StatCard, ErrorBoundary
    layout/                Navbar, Footer, PublicLayout, AuthLayout, DashboardLayout (+ Owner/Admin/SuperAdmin/Captain wrappers)
    stadium/                StadiumCard, FieldCard, SlotPicker, FiltersModal, CityChips
    booking/                BookingCard, MatchPass (QR)
  pages/                   Home, Login, Register, Stadiums, StadiumDetails, Tournaments, HowItWorks, Pricing, About, NotFound
    CaptainDashboard / Favorites / CaptainSettings
    MyTeams / TeamDetails / MyBookings / BookingDetails
    owner/                  OwnerDashboard, OwnerStadiumForm, OwnerStadiumDetail
    admin/                  AdminDashboard, AdminUsers, AdminStadiums
    superadmin/             SuperAdminDashboard, PlatformSettings
  routes/                  AppRoutes (lazy page chunks + Suspense), ProtectedRoute, RoleRoute
```

## Auth & sessions

- Page components are loaded with `React.lazy` + `Suspense` so dashboard and marketing routes are separate chunks. Layouts stay eager.
- `ErrorBoundary` wraps the app so a render crash shows a branded recovery screen instead of a white page.
- Wrong-role visits (e.g. a stadium owner hitting `/app`) redirect to that role's dashboard (`dashboardPathForRole`), not the marketing home.
- Access token lives in memory only (`api/axiosClient.js`); the refresh token is an httpOnly cookie set by the server.
- On app load, `restoreSession()` calls `POST /auth/refresh` then `GET /auth/me` to silently resume a session.
- A 401 on any request triggers a single in-flight refresh (deduped via a shared promise) and retries the original request; if refresh also fails, the user is logged out client-side (`sessionExpired`).

## Booking flow implemented end-to-end

1. **Search** (`/stadiums`) → **Stadium details** (`/stadiums/:id`): pick a field, date, client-generated hourly slot, player count, and one of your teams → holds the slot (`POST /bookings`).
2. **Booking details** (`/app/bookings/:id`): Team A pays their share; optionally invite Team B by pasting their team ID (looked up via the public `GET /teams/:id` to confirm captain + name before inviting); Team B then pays their share.
3. Payment uses the backend's dev-only mock-confirm endpoint to simulate a provider webhook succeeding — swap this for a real provider integration later without touching the UI contract.
4. Once `CONFIRMED`, a **Digital Match Pass** (QR code + booking code) renders on the booking details page; check-in and cancel actions are available per the booking's current status.

## Real-time updates

`useSocket` connects once authenticated, authenticates the socket with the current access token, and listens for `booking:updated` (merged into the Redux `bookings` slice) and `payment:received` (toast). `useFieldAvailabilitySubscription(fieldId)` is available for subscribing a specific field's room for future live-availability UI.

## What's intentionally out of scope for now

Matches the server's Phase 1 MVP: no recurring bookings, discounts, no-show detection, tournament UI (placeholder page only), disputes/refunds, or push/email/SMS notifications yet. Dashboards for Owner/Admin/Super Admin are functional but intentionally lean (core CRUD + stats) — see the root `README.md` and `server/README.md` for the full phased roadmap.
