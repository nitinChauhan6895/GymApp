# GymApp — Gym Membership Management (MVP)

A lightweight, mobile-first Progressive Web App for gym owners and receptionists to manage
memberships, renewals, payments and member data — so no membership expires unnoticed.

Built per the v1.0 PRD: this is intentionally **not** a full gym ERP. Attendance, workouts,
trainer management, diet plans and payment gateways are out of scope for the MVP.

## Features

- **Dashboard** — live stats (active members, expiring today / in 7 days, expired, payments
  today, renewals this month), recent activity feed, and one-tap quick actions.
- **Members** — fast search (name / phone / email), status filters (All, Active, Expiring
  Soon, Expired), member cards with photo, plan, expiry and outstanding amount.
- **Member Profile** — personal info, current membership with remaining days, immutable
  payment history, membership history, notes, plus Renew / Record Payment / Edit actions and
  one-tap Call & WhatsApp.
- **Add Member** — personal details + optional package assignment and first payment in a
  single form. Duplicate phone detection built in.
- **Renewals** — Today / 3 Days / 7 Days / Expired tabs, each card with Renew, Call and
  WhatsApp (pre-filled reminder message) buttons. Renewing extends from the current expiry
  when still active, or starts today when lapsed.
- **Payments** — Cash / UPI / Card / Bank Transfer, discounts, reference numbers, remarks,
  recorded-by employee. History is append-only (immutable).
- **Packages** — owner-managed packages; 1/3/6/12-month defaults seeded on first run.
- **Campaigns** — 3 editable poster templates (offer, price, dates, gym name, phone, logo)
  rendered on canvas and exported as PNG, with campaign history.
- **Reports** — active/expired members, upcoming renewals, revenue, discounts, payment-mode
  split, new members. Export to Excel (multi-sheet .xlsx) or PDF (print).
- **Import** — upload a Go Gym Excel export (or any .xlsx/.csv), preview, validate, flag
  duplicates, and import members with their plans and expiry dates.
- **Notifications** — in-app notification center (expiring today / tomorrow / this week,
  outstanding balances, recently expired) plus an optional daily browser notification
  morning summary.
- **Settings** — gym details & logo, package management, employees, notification
  preferences, JSON backup & restore.

## Tech Stack

| Layer   | Choice                                        |
| ------- | --------------------------------------------- |
| UI      | React 18 + TypeScript, mobile-first custom CSS |
| Routing | React Router (hash-based, static-host friendly) |
| Data    | IndexedDB via Dexie (local-first, offline-ready) |
| Excel   | SheetJS (`xlsx`) for import & export           |
| PWA     | Web manifest + service worker (installable, cached) |
| Build   | Vite                                           |

All data is stored on-device in IndexedDB — no backend required. Use
**Settings → Backup** to export/restore a full JSON snapshot.

## Getting Started

```bash
npm install
npm run dev      # start dev server
npm run build    # type-check + production build (dist/)
npm run preview  # serve the production build
```

## Deployment

The repo is configured for **Vercel** (`vercel.json`: Vite framework, `dist/` output,
long-cache assets, never-cached service worker). Import the GitHub repo at
[vercel.com/new](https://vercel.com/new) and every push to `main` deploys automatically,
with preview deployments for pull requests. Phase 2 server pieces (API keys, Supabase)
can live in Vercel serverless functions and environment variables alongside the app.

Because routing is hash-based and assets are relative, the build also works on any other
static host with no server configuration.

## Data Model

`members`, `memberships` (history preserved; renewals link via `renewedFrom`), `packages`,
`payments` (append-only), `employees`, `campaigns`, `activities`, `settings` — see
`src/types.ts` and `src/db.ts`.

## Roadmap (post-MVP)

Attendance & QR check-in, WhatsApp/SMS reminder automation, member mobile app, online
payment links, multi-branch support, and AI-powered renewal predictions.
