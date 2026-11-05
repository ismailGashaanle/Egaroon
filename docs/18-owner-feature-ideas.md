# Owner feature ideas (roadmap backlog)

Ideas beyond the current owner checklist (items 1–8). Track here for Phase 9+.

**Mobile note (2026):** Owner app now supports create/edit for stadium, fields, hours, managers, discounts, blocks, recurring weekly slots, cup create + fixtures list, reports export share, and profile/notifications — wired to existing `/api` routes only. Items 9–13 below still have **no dedicated APIs** (or only partial signals); do not invent clients for them yet.

## 9) Reviews & ratings
Captains rate fields after SETTLED matches. Owner sees average rating and response tools. Affects search ranking.
*(Reports already surface `avgRating` / `reviewCount` when present — full review moderation UI is next-phase.)*

## 10) Multi-language (So / En / Ar)
Stadium name, rules, and booking SMS/email in Somali and English (Arabic optional). Owner sets default language.
*(Mobile UI labels are Somali-friendly; stadium content i18n fields are not in the stadium create API yet.)*

## 11) Push / WhatsApp / SMS notifications
Slot held, Team B unpaid (10 min), tournament fixture published, payout settled.
*(Mobile polls `/notifications` today — no Expo push token registration / WhatsApp adapter yet.)*

## 12) Dynamic surge pricing
Weekend / evening / holiday multipliers on top of base pricePerPlayer. Owner toggles rules per field.
*(Current discounts API is percent/amount off windows — not surge multipliers.)*

## 13) Waitlist & open challenges
If a slot is booked but Team B drops, waitlisted captains get first offer. “Open challenge” listings for captains seeking opponents.
