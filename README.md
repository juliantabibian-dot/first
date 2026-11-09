# Lookout

Upload photos and pick who watches each one. If a watched photo is shared, downloaded,
screenshotted or deleted, its watchers get a text. Watchers are just phone numbers; they
don't need the app.

The full product spec and the original web prototype are in [docs/handoff.md](docs/handoff.md).

## Decisions so far

Where these differ from the handoff, these win.

| Question | Answer |
|---|---|
| Stack | Expo (React Native) + Expo Router, Supabase, Twilio |
| Sign-in | Phone number + texted code |
| Platform | iPhone first (Android later from the same code) |
| Audience | Friends sharing private photos |
| Downloads | Chosen per photo at upload: allowed (watchers are texted) or blocked. It can't be changed afterwards; the database enforces that. |
| Sharing | Through the iPhone share sheet, like sharing from the camera roll. No in-app sharing between Lookout users, so there are no "shared with me" photos. |
| Screen recording | Triggers an alert, same as a screenshot |

## Status

- **Milestone 1, skeleton: done.** Phone sign-in, first-run name screen, Photos / Watchers /
  Texts tabs, account screen with sign out, database schema with access rules.
- **Milestone 2, photos: done.** Pick up to 20 photos from the camera roll, choose the
  download setting, upload to private storage, see them in a grid, open one full screen.
  Photos are shrunk to 1600px JPEGs on upload, which also strips location data. There is
  no way to save a photo out of the viewer.
- **Next, milestone 3:** add a watcher's number, text them a code (Twilio), confirm it.

Not built yet: watchers, texts, share, download, delete, screenshot and screen-recording
alerts. Until delete exists, remove test photos from the Supabase dashboard.

## Run it on your iPhone

You need a computer with [Node.js](https://nodejs.org) 20+ and the free **Expo Go** app on
your phone. Phone and computer must be on the same Wi-Fi.

1. **Create the backend.** Make a free project at [supabase.com](https://supabase.com).
   Open **SQL Editor** and run each file in `supabase/migrations/` in order (`0001`, then
   `0002`): paste in the whole file, run it, then do the next one.
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
  add-photos.tsx     after picking: choose the download setting, then upload
  photo/[id].tsx     full-screen viewer
  account.tsx        sign out
components/          shared UI
lib/                 Supabase client, auth state, photo loading and upload, theme
supabase/migrations  database schema and row-level security
```

## Checks

```bash
npm run typecheck
```
