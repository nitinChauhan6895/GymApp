---
name: verify
description: Build, serve and drive the GymApp PWA end-to-end in headless Chromium to verify changes at the UI surface.
---

# Verifying GymApp

GymApp is a local-first React PWA (Vite + Dexie/IndexedDB). There is no backend —
the surface is the browser UI. Verify by driving the built app with Playwright.

## Build & serve

```bash
npm run build                      # tsc + vite build → dist/
npx vite preview --port 4173 &     # serve the production build
```

## Drive

The system Playwright (`/opt/node22/lib/node_modules/playwright/index.mjs`) plus the
pre-installed Chromium works headless. Use a mobile viewport (390x844) — the app is
mobile-first. Each fresh browser context starts with an empty IndexedDB, so seed data
through the UI (Add Member form) as part of the flow.

Key flows worth driving after changes:
1. Add member with a package (amount auto-fills to price after discount) → profile shows
   plan, expiry (= joining date + duration months), Outstanding.
2. Set a past Joining Date to fabricate an expired member (e.g. 2 months ago + 1 Month
   package) — this is how you populate the Renewals "Expired" tab and Notifications.
3. Renew from the Renewals tab: expired member restarts today; active member extends
   from current expiry (check the summary box date).
4. Dashboard quick action "Record Payment" → member picker → modal pre-fills the
   outstanding balance (lifetime billed − lifetime paid, carries across renewals).
5. Excel import: generate a .xlsx in the test script with the project's own `xlsx` dep
   (`import * as XLSX from '<repo>/node_modules/xlsx/xlsx.mjs'; XLSX.set_fs(fs)` —
   without `set_fs`, `writeFile` throws in Node ESM). Include a duplicate phone and a
   missing-name row to exercise validation.
6. Downloads (Excel report, poster PNG, JSON backup) via Playwright's
   `page.waitForEvent('download')` with `acceptDownloads: true`.

## Gotchas

- Text assertions: CSS uppercases labels (`OUTSTANDING`) and the en-IN locale renders
  September as "Sept" — match case-insensitively and prefer regexes over exact dates.
- `confirm()` dialogs (delete member, restore backup) — attach a `page.on('dialog')`
  handler before clicking.
- Routing is hash-based: navigate to `http://localhost:4173/#/members` etc.
