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
npx eas-cli@latest build --platform ios --profile production   # App Store build (asks for the Apple login)
npx eas-cli@latest submit --platform ios --latest              # send it to App Store Connect
```

## Also in 1.0 (second round, 2026-11-11)

Flight tracker card (same data as the CRM), receipt with share, "Pay by card" that opens the Square invoice inside
the app (edge function `client-pay` makes the invoice when there is none yet), rating after the ride (5 stars →
Google review), saved places, booking for someone else, extras, invite code, Add to Calendar, "Where we meet".
Backend for these: `supabase/client_app_v2.sql` in the CRM repo.

## Not in 1.0

Live map of the chauffeur (needs GPS in PER Driver) and Spanish — planned as 1.1. Android — later; needs a Google
Play account.
