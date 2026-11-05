# E-Garoon Mobile (Phase 1)

Expo (managed) app for **Team Captain**, **Stadium Owner**, and **Stadium Manager**.  
No Super Admin / Admin UI.

## Prerequisites

1. Node 20+ and Expo Go on your phone (or an emulator).
2. Backend running locally:

```bash
cd server
npm install
npm run seed   # optional — demo users
npm run dev    # default http://localhost:5000
```

Demo password (after seed): `Demo1234!`  
Examples: `captain@demo.kulansiiye`, `owner@demo.kulansiiye` (see seed console output).

**Gate QR scan (owner + manager):** tab **Scan** — camera (device only; not Expo web) → validate → **Bilow ciyaarta**. Same API: `POST /api/owner/check-in`. Manager accounts are invited by the owner (not in default seed).

## Configure API URL

```bash
cd mobile
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` to your machine’s reachable API (include `/api`):

| Where you run the app | Example |
| --- | --- |
| iOS Simulator | `http://localhost:5000/api` |
| Android Emulator | `http://10.0.2.2:5000/api` |
| Physical device | `http://YOUR_LAN_IP:5000/api` (e.g. `http://192.168.1.20:5000/api`) |

Restart Expo after changing `.env`.

> Native apps do not use browser CORS. Ensure the phone/emulator can reach the host port (firewall / same Wi‑Fi).

## Install & run

```bash
cd mobile
npm install
npx expo start -c
```

Use `-c` (clear Metro cache) after Tailwind/NativeWind or babel/metro config changes.

Then press `a` (Android), `i` (iOS), or scan the QR with Expo Go.

## NativeWind (Tailwind for RN)

Styling uses **NativeWind v4** + **Tailwind CSS v3** (compatible with Expo SDK 54).

| File | Role |
| --- | --- |
| `global.css` | `@tailwind` layers — imported from `App.js` |
| `tailwind.config.js` | Content paths + brand colors (`brand-orange`, `brand-navy`, …) |
| `babel.config.js` | `jsxImportSource: 'nativewind'` + `nativewind/babel` |
| `metro.config.js` | `withNativeWind` wrapper |
| `nativewind-env.d.ts` | `className` types |

Prefer `className` on screens; keep `StyleSheet` / inline styles only where awkward (tab bar, QR, camera). Brand tokens also live in `src/theme.js` for Navigation / non-Tailwind APIs.

## Phase 1 features

| Role | Tabs | Notes |
| --- | --- | --- |
| Captain | Hoyga · Ballamo · Raadi · Dheeraad | Raadi: stadium → field → slots; GPS / `availableNow`; bookings + tixraac QR |
| Owner | Hoyga · Warbixin · Dheeraad | Notifications or `?mine=true` stadiums; reports stub |
| Manager | Scan · Maanta · Dheeraad | Camera / manual code → `POST /owner/check-in` |

Auth: `POST /auth/login`, `POST /auth/register` (OTP optional via `OTP_ENABLED`), token in **expo-secure-store**.  
OTP UI follows `GET /auth/features` (`otpEnabled`). When enabled, Register shows a **Demo OTP** banner if the API returns `devCode` (mock / non-production).

Out of scope (Phase 2+): payment modal, lineup, full slot booking grid.

## Theme (Super Transportation)

- Header / accent orange `#F5A623` (`brand-orange`)
- CTA / chrome navy `#1A237E` (`brand-navy`), soft `#2D3250`
- Background `#F2F3F7`, white cards ~14px radius
- Slot status: green / red / yellow
- Bottom tabs: white bar, orange label + underline when active
