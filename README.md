# Lookout

Upload photos and pick who watches each one. If a watched photo is shared, downloaded,
screenshotted or deleted, its watchers get a text. Watchers are just phone numbers; they
don't need the app.

The full product spec and the original web prototype are in [docs/handoff.md](docs/handoff.md).

## Decisions so far

| Question | Answer |
|---|---|
| Stack | Expo (React Native) + Expo Router, Supabase, Twilio |
| Sign-in | Phone number + texted code |
| Platform | iPhone first (Android later from the same code) |
| Audience | Friends sharing private photos |

Still open: block downloads or allow with an alert, whether recipients can re-share,
push notifications to the owner, and alerts for screen recording.

## Status

Milestone 1 of 8 (skeleton) is done: phone sign-in, a first-run name screen, the
Photos / Watchers / Texts tabs (empty for now), an account screen with sign out, and the
database schema with access rules. Next is milestone 2: uploading and viewing photos.

## Run it on your iPhone

You need a computer with [Node.js](https://nodejs.org) 20+ and the free **Expo Go** app on
your phone. Phone and computer must be on the same Wi-Fi.

1. **Create the backend.** Make a free project at [supabase.com](https://supabase.com).
   Open **SQL Editor**, paste in all of `supabase/migrations/0001_init.sql`, and run it.
2. **Turn on phone sign-in.** In Supabase go to **Authentication → Sign In / Providers →
   Phone** and enable it. Real texts need a Twilio account connected there. To try the
   app before setting up Twilio, add a test number and code under "Test phone numbers
   and OTPs" on the same page (for example `15555550100=123456`), then sign in with those.
3. **Connect the app.** Copy `.env.example` to `.env` and fill in the two values from
   **Project Settings → API**.
4. **Start it.**
   ```bash
   npm install
   npx expo start
   ```
   Scan the QR code with the iPhone camera. The app opens in Expo Go.

If the app says it isn't connected to a backend, `.env` is missing or the server needs a
restart with `npx expo start --clear`.

## Layout

```
app/                 screens (Expo Router). _layout.tsx decides which screens you can reach.
  sign-in.tsx        phone number, then texted code
  welcome.tsx        first sign-in: your name
  (tabs)/            Photos, Watchers, Texts
  account.tsx        sign out
components/          shared UI
lib/                 Supabase client, auth state, theme, phone formatting
supabase/migrations  database schema and row-level security
```

## Checks

```bash
npm run typecheck
```
