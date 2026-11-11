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
| Screenshots and recording | Blanked by iOS while photos are on screen. A screenshot in the viewer also texts the watchers. Recording can't be detected yet, only blanked. |
| Blocked photos | Can't be downloaded or shared (the share sheet can save too) |
| Failed download or share | Nobody is texted |

## Status

- **Milestone 1, skeleton: done.** Phone sign-in, first-run name screen, Photos / Watchers /
  Texts tabs, account screen with sign out, database schema with access rules.
- **Milestone 2, photos: done.** Pick up to 20 photos from the camera roll, choose the
  download setting, upload to private storage, see them in a grid, open one full screen.
  Photos are shrunk to 1600px JPEGs on upload, which also strips location data. There is
  no way to save a photo out of the viewer.
- **Milestone 3, watchers: done.** Add someone's name and number, text them a 6-digit code,
  enter the code they read back to confirm them, send a test text, remove them (a
  confirmed watcher is texted that they were removed). If a watcher replies STOP they are
  marked opted out and not texted again unless they reply START. The Texts tab lists every text sent. Until
  Twilio is connected, texts are only simulated (see [Texting](#texting-twilio)).
- **Backend: set up.** A Supabase project has the three migrations applied, the five
  functions deployed (checked: they start, and refuse callers who aren't signed in), and
  Twilio connected for phone sign-in and texts. The version published to Expo uses it;
  local runs stay in demo mode unless `.env` points them at the project.
- **Milestone 4, watchers per photo: done.** After an upload the app asks who watches the
  new photos; the viewer shows who gets a text and has a Watchers button to change it.
  Anyone added or removed is texted. Photo tiles show the watcher count.
- **Texting on a Twilio trial.** Trial accounts can only send Twilio's sample messages, so
  the functions detect a trial and behave as if Twilio weren't connected: texts are logged
  in the Texts tab as "not actually sent". Real texts start once the Twilio account is
  upgraded. Phone sign-in has the same limit; until then a test number and code are set
  in Supabase (Authentication → Phone).
- **Milestone 5, alerts: done.** In the viewer: Share (iPhone share sheet), Download (to
  the camera roll) and Delete, plus screenshot detection. Each one texts that photo's
  watchers. A photo uploaded with downloads blocked offers neither Share nor Download,
  because the share sheet can also save. If a download or share fails or is cancelled,
  nobody is texted. If the phone is offline when something happens, the alert is kept and
  sent the next time the app loads.
- **Screenshots and recordings.** While photos are on screen (the grid and the viewer) iOS
  blanks the app out of screenshots and screen recordings, and the app switcher preview is
  blurred. A screenshot in the viewer still texts the watchers. Screen recording can't be
  detected with the tools available in Expo Go, so it is blanked but not alerted.
- **Milestone 6, safety: done.** After choosing photos you can tick "Delete the originals
  from my camera roll" (iPhone only; iOS asks to confirm). **Account → Delete account**
  removes everything and texts confirmed watchers once. The Account screen says plainly
  what Lookout can't prevent, such as photographing the screen with another phone.
- **Next, store readiness:** an app icon, a hosted privacy policy (draft in
  `docs/privacy-policy.md`), then the launch steps: Apple developer program, an App Store
  build, upgrading Twilio and registering the number.

Not checked on a real iPhone yet: the share sheet, saving to the camera roll, deleting
originals, screenshot blanking and screenshot alerts. They need a phone; the demo only simulates them.

## Try it on your phone

There are two ways, from easiest to most real. Both start in **demo mode**: with no Supabase
keys the app runs a stand-in backend on the phone itself. You can sign in with any number
and any 6-digit code, and everything works except that no text is really sent. Codes and
alerts appear in the Texts tab instead. **Account → Erase the demo** starts over.

### 1. Open the demo link (nothing to install)

The demo is published as a private page on claude.ai. Open its link on your phone while
signed in to claude.ai, and use **Share → Add to Home Screen** in Safari for an app icon.
It runs in the browser, so it can't do iPhone-only things (screenshot alerts, later), and
what you add is stored only in that browser.

To rebuild the page after changing the app: `npm run build:demo-page`. It writes one
self-contained file, `dist/lookout-demo.html`.

### 2. Run the real app in Expo Go

You need a computer with [Node.js](https://nodejs.org) 20+ and the free **Expo Go** app on
your iPhone.

```bash
npm install
npm run phone
```

Scan the QR code with the iPhone camera and the app opens in Expo Go. `npm run phone` uses
a tunnel, so the phone doesn't need to be on the same Wi-Fi (the first time, it may ask to
install a small helper; say yes). On the same Wi-Fi, `npx expo start` is a little faster.

### 3. Open the published app in Expo Go (real backend, no computer)

The app is published to the Expo project `@jetabs-team/jet`, connected to the real Supabase
backend. On the iPhone, install **Expo Go**, sign in with the Expo account, and open the
project from the **Projects** list (branch `main`). Sign-in here sends a real text through
Twilio; on a Twilio trial, only numbers verified in the Twilio console can receive it.

To publish a new version after changing the app (needs `EXPO_TOKEN` set to an Expo access
token):

```bash
npm run publish:phone -- --message "what changed"
```

The backend address and public key it is built with are stored on the Expo project
(**Environment variables → production**), not in this repo.

### 4. Connect a real backend to a local run

When you want real accounts and real texts:

1. **Create the backend.** Make a free project at [supabase.com](https://supabase.com).
   Open **SQL Editor** and run each file in `supabase/migrations/` in order (`0001`, `0002`,
   then `0003`): paste in the whole file, run it, then do the next one. If you set the
   project up before milestone 3, you only need to run `0003`.
2. **Turn on phone sign-in.** In Supabase go to **Authentication → Sign In / Providers →
   Phone** and enable it. Real texts need a Twilio account connected there. To try it
   before setting up Twilio, add a test number and code under "Test phone numbers and
   OTPs" on the same page (for example `15555550100=123456`), then sign in with those.
3. **Connect the app.** Copy `.env.example` to `.env` and fill in the two values from
   **Project Settings → API**, then restart with `npx expo start --clear`. The demo
   notices disappear once the app is connected.
4. **Turn on watchers.** The Watchers tab needs the server functions. Follow steps 1 and 2
   of [Texting](#texting-twilio) below; Twilio itself can wait.

## Texting (Twilio)

Texts to watchers are sent by small server programs ("functions") that live in
`supabase/functions/`. They run on Supabase, not on the phone, so the app never holds a
Twilio password and can't skip telling a watcher about something.

You need to do steps 1 and 2 once before the Watchers tab works. Steps 3 to 5 switch on real
texts and can wait.

1. **Run migration 0003.** In the Supabase **SQL Editor**, paste in all of
   `supabase/migrations/0003_watcher_texting.sql` and run it (skip this if you already ran
   it during setup).
2. **Put the functions on Supabase.** In a terminal, in this folder:
   ```bash
   npx supabase login
   npx supabase functions deploy --remote=YOUR-PROJECT-REF --use-api --yes \
     send-watcher-code verify-watcher-code send-test-text remove-watcher set-photo-watchers report-event delete-account
   npx supabase functions deploy --remote=YOUR-PROJECT-REF --use-api --yes --no-verify-jwt twilio-inbound
   ```
   `YOUR-PROJECT-REF` is the random-looking part of your project's address
   (`https://YOUR-PROJECT-REF.supabase.co`). The last line matters: `twilio-inbound` is
   the one function Twilio calls instead of the app, so it has to accept requests without
   an app sign-in. It checks Twilio's signature on every request instead. Run the same two
   `deploy` lines again whenever the code in `supabase/functions/` changes.

   **You can stop here and try everything.** With no Twilio details set, Lookout runs in
   *simulated mode*: nothing is really sent, each text appears in the Texts tab marked
   "Not actually sent", and the code is shown there so you can type it in yourself.

3. **Create a Twilio account** at [twilio.com](https://www.twilio.com) and get a phone
   number that can send SMS. A free trial account can only text numbers you have verified
   in the Twilio console (**Phone Numbers → Manage → Verified Caller IDs**), so add your
   own and your testers' numbers there first.
4. **Give Supabase the Twilio details.** They are on the Twilio console's front page. Type
   them into this command; never save them in a file in this folder.
   ```bash
   npx supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxx TWILIO_AUTH_TOKEN=xxxxxxxx TWILIO_FROM_NUMBER=+15551234567
   ```
   (Or, without a terminal: in the Supabase dashboard open **Edge Functions → Secrets** and
   add the three by name there.)
   `TWILIO_FROM_NUMBER` is your Twilio number, starting with `+` and the country code. All
   three must be set; from that moment texts are real and codes are no longer shown in the
   app.
5. **Tell Twilio where replies go.** In the Twilio console open **Phone Numbers → Manage →
   Active numbers**, choose your number, and under **Messaging → A message comes in** pick
   **Webhook**, method **HTTP POST**, with exactly this address:
   ```
   https://YOUR-PROJECT-REF.supabase.co/functions/v1/twilio-inbound
   ```
   This is how Lookout learns that a watcher replied STOP (never text them again) or START
   (they changed their mind). If you ever use a different address, set it as a fourth
   secret, `TWILIO_WEBHOOK_URL`, or Lookout will reject Twilio's requests.

Good to know:

- **Watchers you confirmed in simulated mode never got a real code**, so once Twilio is
  connected Lookout refuses to text them. Remove them and add them again.
- The code text is stored in the Texts tab with the code hidden (`••••••`). That is on
  purpose: the only way to get the code is to ask the person who received it.
- Limits, so the app can't be used to pester people: one code per number per minute, 5 per
  number per hour, 30 codes a day per account, 20 watchers per account, and 5 wrong tries
  per code. Test texts have the same per-minute, hourly and daily limits.
- Before launch, US carriers require the Twilio number to be registered (A2P 10DLC). That
  is a later milestone.

## Layout

```
app/                 screens (Expo Router). _layout.tsx decides which screens you can reach.
  sign-in.tsx        phone number, then texted code
  welcome.tsx        first sign-in: your name
  (tabs)/            Photos, Watchers (add, confirm, test, remove), Texts (history)
  add-photos.tsx     after picking: choose the download setting, then upload
  photo-watchers.tsx choose who watches one photo or a fresh batch
  photo/[id].tsx     full-screen viewer
  account.tsx        sign out (and, in the demo, erase it)
components/          shared UI
lib/                 Supabase client, auth state, photo loading and upload, watchers, theme
  demo.ts            the stand-in backend used when there are no Supabase keys
scripts/
  build-demo-page.mjs  builds the demo as one HTML file for the phone link
supabase/migrations  database schema and row-level security
supabase/functions   server functions (Deno). One folder per function:
  send-watcher-code    add a watcher / text a new code
  verify-watcher-code  check the code and confirm the watcher
  send-test-text       "alerts are working" text to a confirmed watcher
  remove-watcher       text a confirmed watcher that they were removed, then delete them
  set-photo-watchers   set who watches photos; texts anyone added or removed
  report-event         a photo was shared, downloaded, screenshotted or deleted: text its watchers
  delete-account       text confirmed watchers, then delete the account and everything in it
  twilio-inbound       Twilio calls this when a watcher replies STOP or START
  _shared/             code they share: sending and logging texts, codes, limits, wording
  tests/               unit tests for the shared logic
```

## Checks

```bash
npm run typecheck
```

The server functions have their own tests, run with [Deno](https://deno.com) (no install
needed; `DENO_NO_PACKAGE_JSON` stops Deno from reading the app's settings):

```bash
DENO_NO_PACKAGE_JSON=1 npx deno test supabase/functions/tests/
DENO_NO_PACKAGE_JSON=1 npx deno check supabase/functions/*/index.ts
```
