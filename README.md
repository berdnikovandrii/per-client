# Pacific Elite Rides — client app

The rider's app (iPhone first): sign in with an email code, book a ride with the price up front, follow it
(status, chauffeur, car, flight), pay the Square invoice, get a push when the ride is confirmed or the chauffeur
is on the way.

- Expo SDK 58, one screen stack in `App.tsx` (no router), same structure as PER Driver.
- Same Supabase project as PER CRM. The app never touches tables: it calls the `client_*` database functions
  and the `client-login` edge function. Both live in the CRM repo: `supabase/client_app.sql`,
  `supabase/functions/client-login/`.
- A booking is a lead in PER CRM with source `App` and status New. Andrii confirms it there; the database
  trigger `leads_client_push` then sends the rider "Your ride is confirmed".
- Prices: `src/lib/pricing.ts` is a copy of the CRM file (zone rates, LAX, hourly). Keep them in sync.
- Address suggestions use the Google Places key `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` (iOS-restricted; the bundle
  id `com.pacificeliterides.app` must be on the key's list). Without the key the field is plain text.

## Commands

```bash
npm install
npx tsc --noEmit                       # typecheck
npx expo export -p ios --output-dir dist-ios   # bundle check
```

Shipping needs no terminal: GitHub → Actions → **Ship** → Run workflow (`.github/workflows/build.yml`).
`store` makes an App Store build and sends it to App Store Connect; `update` publishes an over-the-air update
for the version already in the store. The Apple certificate, the App Store Connect key and the app's values
(Supabase, Google Places, Meta) live on expo.dev, not in the repository.

## 1.0.1 (2026-11-18): the Noir Concierge design

- Dark theme with one gold accent and serif headings (Cormorant Garamond, lining figures). Colours and the
  serif live in `src/theme.ts`; the building blocks (gold button with a sheen, cards, chips, segment, fields,
  rise-in and press motion, haptics) in `src/components/ui.tsx`; the line icons in `src/components/icon.tsx`.
- New native modules, so this version needs a store build: `expo-linear-gradient`, `expo-blur`,
  `react-native-svg`, `expo-haptics`, `react-native-fbsdk-next`.
- Meta SDK (`app.config.js`): counts installs from ads through Apple's anonymous SKAdNetwork — no tracking
  prompt, no advertising ID. One app event, "Schedule", when a ride request is sent (`src/lib/analytics.ts`).
  `META_APP_ID` and `META_CLIENT_TOKEN` must be set in the EAS production environment or the iOS build stops.
- Design mockups: https://claude.ai/artifact/5acKWfQEWQSAzNypXxVALu

## Also in 1.0 (second round, 2026-11-11)

Flight tracker card (same data as the CRM), receipt with share, "Pay by card" that opens the Square invoice inside
the app (edge function `client-pay` makes the invoice when there is none yet), rating after the ride (5 stars →
Google review), saved places, booking for someone else, extras, invite code, Add to Calendar, "Where we meet".
Backend for these: `supabase/client_app_v2.sql` in the CRM repo.

## Not in 1.0

Spanish — planned. Android — later; needs a Google
Play account.
