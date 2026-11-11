# Lookout: handoff for the next coding agent

Read this, then `README.md` (current decisions, setup, layout) and `docs/handoff.md`
(original product spec; where they differ, README wins). `AGENTS.md` has the Expo rules.
Work on branch `claude/new-session-9heks0`. The repo has no other branch, so no pull
request can be opened yet.

## What Lookout is

An iPhone app (Expo SDK 58, Expo Router, TypeScript) backed by Supabase. Users upload
photos into the app and pick watchers (phone numbers) per photo. If a watched photo is
shared, downloaded, screenshotted, screen-recorded or deleted, its watchers get an SMS
(Twilio). The owner is a non-developer working mostly from a phone: keep instructions
plain and do as much as possible for them.

## Done and pushed

- Milestone 1: phone sign-in, name screen, tabs, account screen, schema + RLS.
- Milestone 2: photo upload with a permanent per-photo download setting (`alert` or
  `blocked`, locked by a DB trigger), grid, full-screen viewer.
- Milestone 3: Watchers tab (add, 6-digit code, confirm, test text, remove), Texts tab,
  five Edge Functions with rate limits, STOP/START webhook.
- Demo mode: with no Supabase keys the app runs against `lib/demo.ts`, a stand-in backend
  on the device. `npm run build:demo-page` builds a one-file web version.
- Published to Expo (EAS Update, project `@jetabs-team/jet`, branch `main`, runtime policy
  `sdkVersion` so it opens in Expo Go). `npm run publish:phone -- --message "..."`.

## In progress when this was written (committed as WIP, NOT finished)

Two pieces of work are in the last commit. `npx tsc --noEmit` passes and the Deno unit
tests pass (46), but neither piece is deployed or UI-tested.

### A. Treat a Twilio trial account as try-out ("simulated") mode: code done, NOT deployed

Twilio trial accounts can only send Twilio's own sample messages (error 572006), so every
Lookout text fails on a trial. `effectiveTwilioMode()` in
`supabase/functions/_shared/twilio.ts` now asks Twilio for the account type (cached 5
minutes) and returns `simulated` for a trial. `texts.ts` and `send-watcher-code` use it.
Unit tests are in `supabase/functions/tests/twilio_test.ts`.

**To do:** redeploy the functions (commands in README, "Texting"). Until then the live
backend still runs the old code, and adding a watcher in the published app fails with
"The text couldn't be sent", because the owner's three `TWILIO_*` function secrets are set
and their account is a trial. The owner does not want to touch the Twilio settings.

### B. Milestone 4, choosing watchers per photo: server and data layer done, screens NOT

Done:
- `supabase/functions/set-photo-watchers/index.ts`: input `{ photo_ids, watcher_ids }`,
  makes exactly those watchers watch each photo, texts anyone added or removed, returns
  `{ added, removed }` (people texted). Pure logic in `_shared/assign.ts`, wording in
  `_shared/messages.ts` (`assignedText`, `unassignedText`), tests in `tests/assign_test.ts`.
  NOT deployed. Not covered by an end-to-end test yet.
- `lib/photos.tsx`: each `Photo` has `watcherIds`; `uploadPending` returns `addedIds`;
  `setWatchers(photoIds, watcherIds)` calls the function and refreshes.
- `lib/demo.ts`: the demo backend supports `photo_watchers` reads and `set-photo-watchers`.
- `lib/watchers.tsx`: `callFunction` is now exported.

Still to build (nothing started):
1. `app/photo-watchers.tsx`, a modal taking `ids` (comma-separated photo ids): checkbox
   list of **confirmed** watchers, Save and "Not now". Start with the photo's current
   watchers when there is one id, empty for a fresh batch. Say that anyone added or removed
   gets a text. If there are no confirmed watchers, explain and link to the Watchers tab.
   Register it in `app/_layout.tsx` next to `add-photos`.
2. `app/add-photos.tsx`: after a successful upload, go to the picker with the new ids
   (`router.replace`) instead of `router.back()`. Keep ids from a partially failed batch.
3. `app/photo/[id].tsx`: a line saying who gets a text ("If anything happens to this
   photo, Mom and Dad get a text." / "No one is watching this photo.") and a Watchers
   button that opens the picker.
4. `app/(tabs)/index.tsx`: per-tile tag with the watcher count, or "No watchers".
   Optionally a banner when there are no confirmed watchers yet.
5. `app/(tabs)/watchers.tsx`: "watching N photos" on confirmed rows.
6. Deploy `set-photo-watchers`, rebuild the demo page, republish to Expo, update README.

## Next after that

- Milestone 5, the alerts: a `report-event` function plus Share (iOS share sheet),
  Download (`expo-media-library`; only for `alert` photos), Delete (soft delete, texts
  watchers), screenshot and screen-recording detection (`expo-screen-capture`; check it
  works in Expo Go, otherwise a development build is needed). Templates are in
  `docs/handoff.md` section 8. Open question for the owner: if a download fails, send
  nothing or a "tried to download" text?
- Milestone 6: blur in the app switcher, offer to delete camera-roll originals, in-app
  account deletion (`delete-account` function; Apple requires it).
- Launch: upgrade Twilio and register the number (A2P 10DLC), Apple developer program.

## Live services (no secrets are in this repo)

| Service | Detail |
|---|---|
| Supabase | Project ref `lxbfhotirhvkmyzkfzlq`. Migrations 0001 to 0003 applied. Five functions deployed (old code, see A). Phone sign-in enabled with Twilio. A test phone number and code are configured under Authentication → Phone → test numbers, because the Twilio trial cannot send the sign-in text; the owner has the code. |
| Twilio | Trial account. Details are saved in Supabase (Auth phone provider and three `TWILIO_*` function secrets). The inbound webhook may not be set; it only matters for STOP/START. |
| Expo | Project `@jetabs-team/jet`, id in `app.json`. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are stored as plain-text variables in its `production` environment and are baked in by `eas update --environment production`. |
| Demo page | Private claude.ai artifact built from `dist/lookout-demo.html`. Only the previous assistant session can republish it to the same link. |

To act on Supabase or Expo you need a Supabase personal access token (`sbp_...`) and an
Expo access token from the owner. Ask them to provide these through a secure channel, never
pasted into chat or committed.

## How to verify

```bash
npx tsc --noEmit
DENO_NO_PACKAGE_JSON=1 npx deno test supabase/functions/tests/
DENO_NO_PACKAGE_JSON=1 npx deno check supabase/functions/*/index.ts
npm run build:demo-page      # then open dist/lookout-demo.html and click through
```

Earlier milestones were also checked with Playwright scripts against a mocked backend and
with an in-memory harness that runs the function entry points. Those scripts lived in a
temporary folder and are not in the repo; rewrite them if needed. Nothing has been
verified with a signed-in user on the real Supabase project, or on a real iPhone beyond
the owner reaching the sign-in screen in Expo Go.

## Rules the code follows

- The app only READS `watchers`, `photo_watchers`, `events`, `texts`. Anything that must
  send a text goes through an Edge Function with the service role.
- The owner can read `texts`, so a real code is never stored there in live mode (masked).
- Never edit an applied migration; add a new numbered file.
- On web, `<Link asChild>` around a `Pressable` with an array style crashes; use
  `router.push`. Browser `confirm()` is unavailable in the hosted demo; use
  `confirmDestructive` from `lib/confirm.ts`.
- `npx expo install` and docs.expo.dev may be blocked in sandboxes; use
  `node -p "require('expo/bundledNativeModules.json')['<pkg>']"` for versions and read the
  type definitions in `node_modules`.
