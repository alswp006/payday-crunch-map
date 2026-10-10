🇺🇸 [한국어](./README.ko.md)

# 텅장달력 (Payday Crunch Map) — Find the day your balance runs thinnest before payday

텅장달력 is a Toss mini-app (App-in-Toss) that projects your bank balance day by day. You enter your take-home pay, payday, and current balance, then register recurring withdrawals such as rent, card bills, and subscriptions. The app plots the expected balance on a calendar and highlights the crunch: the lowest-balance day before the next salary arrives. It is built for salaried users who want to see when fixed payments cluster before payday, and it stores all data on the device.

## Features

- 📅 **Balance calendar**: Shows the projected low balance for every day of the current month and the next month.
- 📉 **Lowest-day card**: Highlights the lowest-balance day of the month with a sparkline and a shortfall caption when the balance goes negative.
- 🔍 **Day details**: Tap a calendar day to see the salary and withdrawals scheduled for it.
- 🗒️ **Schedule list**: Lists every salary and withdrawal event for the month in date order.
- 💰 **Salary and balance setup**: Enter take-home pay, payday (with a weekend rule: keep, previous business day, or next business day), and the balance as of a given date.
- 🔄 **Stale balance handling**: Prompts you to update the balance when the balance date is from a previous month, and hides projections when it is more than 62 days old.
- 🧾 **Withdrawal items**: Add, edit, and delete up to 30 recurring withdrawals, each with a name (up to 20 characters), amount, day of month, and weekend rule.
- 🗓️ **Effective-month day changes**: When a withdrawal day changes, the new day applies from the next month, so past projections are not rewritten.
- 🎯 **Payment-day simulation**: Shows the best alternative payment day for each withdrawal and lets you compare and save a new day. This section is unlocked by watching a rewarded ad.
- 📤 **Share**: Share your balance calendar with a deep link that opens the home screen.
- 🆕 **New-month notice**: Shows a one-time toast the first time you open the app in a new month.
- 📊 **Usage logging**: Logs screen views and key button clicks through the Apps-in-Toss `Analytics` SDK.

## Tech Stack

- **Framework**: React 18 with TypeScript, built with Vite 6 as a static client-side bundle
- **Routing**: React Router 7 (`react-router-dom`)
- **UI**: Toss Design System (`@toss/tds-mobile`, `@toss/tds-mobile-ait`, `@toss/tds-colors`), `lucide-react` icons, and `@emotion/react` / `@emotion/styled`
- **Platform SDK**: `@apps-in-toss/web-framework` (haptics, share, review request, analytics, banner and rewarded ads)
- **Storage**: Browser `localStorage` only (no server, no database)
- **Authentication**: None. The app does not require Toss login.
- **Testing**: Vitest with jsdom and Testing Library; Playwright for visual smoke tests

## Getting Started

Requirements: Node.js and npm. The project uses npm, not pnpm.

```bash
# Install dependencies
npm install

# Production bundle (output in dist/)
npx vite build

# Toss mini-app bundle
npx ait build
```

Run the test suite with `npx vitest run` and the visual smoke tests with `npm run test:visual`.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values issued in the Apps-in-Toss console. Vite replaces these at build time, so rebuild after changing them. Leaving a value empty disables only that feature.

| Variable | Description | Required |
|---|---|---|
| `VITE_TOSS_AD_GROUP_ID` | Banner ad group ID shown on the home screen. Without it, the banner is not rendered. | No |
| `VITE_TOSS_AD_SLOT_ID` | Rewarded full-screen ad slot ID that gates the payment-day simulation. Without it, the gate opens automatically. | No |
| `VITE_SHARE_OG_URL` | Preview image URL attached to shared links. Without it, no preview image is attached. | No |
| `VITE_TOSS_IAP_SKU` | In-app purchase SKU read by the `TossPurchase` component. That component is not mounted by any screen. | No |

Do not hard-code placeholder IDs in source. Values from the console must come from these variables.

## Project Structure

```
src/
├── pages/        # Screens: Home (calendar), Setup (salary and balance), Items (withdrawals)
├── components/   # Shared UI wrappers (ads, tab bar, storage guard) plus home/, items/, form/ subfolders
├── lib/          # Pure logic: balance/ (projection engine), date/, store/ (load, save, validate), analytics, review, share
├── state/        # AppDataProvider context that holds settings, withdrawals, and metadata
├── types/        # Route state types shared between screens
├── styles/       # Global and ad CSS
├── test/         # Integration and audit tests
└── __tests__/    # Unit and packet tests
e2e/              # Playwright visual smoke tests and screenshots
scripts/          # Build-time checks (forbidden patterns, dev-code leak, finish gate)
```

## Deployment

1. Set the `VITE_*` values in `.env` for the production build.
2. Confirm `appName` in `apps-in-toss.config.ts` (`payday-crunch-map`) exactly matches the app name registered in the Apps-in-Toss console, including case. A mismatch fails deployment with error 4031.
3. Run `npx ait build` to produce the bundle for the Toss CDN. The app is a static build, so server-side rendering is not available.
4. Upload the build through the Apps-in-Toss developer console and submit it for review. Toss reviews apps against its launch guidelines. Check the console for review status and any feedback, and resubmit after fixing reported issues.

## License

MIT
