# Lookout: project handoff

> **For Claude Code:** This file is the full handoff for Julian's app idea. Read all of it before starting. Julian came up with the idea and made the product decisions below. A working web prototype exists (full source in the appendix). The next job is turning it into a real iPhone app that can go on the App Store. Before writing code, confirm the stack and first milestone with Julian and ask him the open questions in section 9. Build in small, testable steps he can run on his own phone.

---

## 1. What the app is

Lookout lets you upload photos into the app and pick specific people to watch each photo. If anyone shares, downloads, screenshots or deletes a watched photo, that photo's watchers get a **text message**. Watchers are just phone numbers. They don't need the app or an account.

Julian's original pitch: *"An app where if you share or download or do anything with a picture it notifies listed contacts, and to make sure it works it tests it with a code, and people have accounts."*

## 2. Product decisions Julian made

1. **Photos live inside the app.** You upload them from your camera roll. The app can only track the copy inside the app. iOS and Android don't let an app see what happens in the camera roll.
2. **Users have accounts** (sign up / sign in).
3. **Watchers are assigned per photo, not globally.** Julian said: "I don't mean alerted for all the photos, I mean you assign people to certain photos."
4. **Watchers are reached by phone number via SMS.** Julian said: "It should be able to notify with just their phone number, like with texts." Watchers don't need the app.
5. **The "test it with a code" idea:** when you add a watcher's number, the app texts them a 6-digit code. They give it to you and you enter it, which proves the number is real and reachable. There is also a "Send test text" button.

## 3. Decisions made while building the prototype (keep unless Julian says otherwise)

- **Watchers get texted when they're added *and* when they're removed** from a photo, so nobody can quietly drop a watcher before sharing.
- Only **confirmed** (code-verified) numbers can be assigned to photos or receive alerts.
- **After an upload**, the app immediately asks "Who watches these photos?" (multi-select, applies to the whole batch).
- **After an upload, offer to delete the originals** from the camera roll, so the only copy is the protected one. This needs user confirmation (iOS shows a system prompt).
- **Long-press save is blocked.** The only way to save a photo out is the app's own Download button, which fires an alert.
- **Photos blur when the app goes to the background**, so the app-switcher snapshot doesn't show them.
- **Sharing (prototype):** in-app share to another Lookout user. If the recipient downloads or screenshots it, the **original photo's watchers** are texted, and the text names who did it.
- Every texted alert is logged in a **"Texts sent"** history the owner can see.

## 4. Platform facts that shape the design

- **No app can monitor the camera roll** or other apps on iOS or Android. Everything tracked has to happen inside Lookout.
- **Screenshots:** iOS reports that a screenshot was taken (it can't block it) and can tell when the screen is being recorded. Android 14+ has a screenshot-detection callback, and Android can also block screenshots outright with FLAG_SECURE. In Expo, look at `expo-screen-capture` (screenshot listener, prevent-capture). **Check the current docs for exact APIs and Android permission requirements.**
- **Can't be prevented by anyone:** someone photographing the screen with a second phone. Be upfront about this in the app.
- **Downloads:** once saved to the camera roll, the photo leaves Lookout's control. Decide whether to block downloads or allow them with an alert. The prototype allows them with an alert.
- **Sharing outside the app** through the iOS share sheet can be detected (React Native's `Share.share` reports whether it was shared). After that, the photo is outside the app's control.

## 5. Recommended stack

| Piece | Choice | Why |
|---|---|---|
| App | **Expo (React Native) + Expo Router**, TypeScript | One codebase for iPhone and Android. Builds iOS in the cloud, so no Mac needed. Julian can test instantly with Expo Go. |
| Accounts, database, photo storage | **Supabase** (Auth, Postgres with Row Level Security, private Storage bucket, Edge Functions) | Free tier, simple, and keeps secrets server-side. |
| Texting | **Twilio** Programmable Messaging, sent **only from a server function** | The client never holds Twilio keys. Roughly a cent per US text including carrier fees. A Twilio trial account can only text numbers you've verified with Twilio, which is fine for development. |
| Builds and submission | **EAS Build + EAS Submit** | Cloud iOS builds, TestFlight, App Store, all without a Mac. |

Alternative: Firebase (Auth, Firestore, Storage, Cloud Functions) works just as well if Julian prefers it.

## 6. Data model (Postgres / Supabase)

```sql
profiles        (id uuid pk = auth.users.id, name text, username text unique, created_at)
watchers        (id uuid pk, owner_id uuid -> profiles, name text, phone_e164 text,
                 status text check in ('pending','verified','opted_out'),
                 code_hash text, code_expires_at timestamptz, verified_at timestamptz,
                 created_at, unique(owner_id, phone_e164))
photos          (id uuid pk, owner_id uuid -> profiles, storage_path text,
                 created_at, deleted_at timestamptz null)
photo_watchers  (photo_id -> photos, watcher_id -> watchers, added_at, pk(photo_id, watcher_id))
photo_shares    (photo_id -> photos, recipient_id -> profiles, shared_at, pk(photo_id, recipient_id))
events          (id uuid pk, photo_id null, actor_id -> profiles,
                 type text check in ('share','download','screenshot','screen_record','delete',
                                     'watcher_added','watcher_removed','test'),
                 meta jsonb, created_at)
texts           (id uuid pk, owner_id -> profiles, watcher_id -> watchers, event_id null,
                 body text, twilio_sid text, status text, created_at)
```

**Row Level Security:**
- Owners see and edit their own watchers, photos and photo_watchers.
- Share recipients can read photos shared with them, but not the watcher list.
- `texts` and `events` are written only by Edge Functions (service role).
- The photo storage bucket is **private**. Serve images with short-lived signed URLs.

## 7. Server functions (Supabase Edge Functions)

- `send-watcher-code`: create a 6-digit code, store a hash plus a 10-minute expiry, text it, and rate-limit it.
- `verify-watcher-code`: check the code and mark the watcher `verified`. Text "You're confirmed".
- `set-photo-watchers`: diff the old and new watcher lists, then text the people added and removed.
- `report-event`: the client calls this with `{photo_id, type}`. The server checks the caller owns the photo or it was shared with them, logs the event, texts that photo's **verified** watchers, and logs the texts.
- `send-test-text`
- `twilio-inbound` webhook: on STOP, mark the watcher `opted_out`. On START, set them back to `verified`.
- `delete-account`: Apple requires in-app account deletion for any app that has account creation.

**Download flow:** the user taps Download, then the app calls `report-event` and saves to the camera roll with `expo-media-library`. If the save fails, don't send the alert, or send a "tried to download" alert instead. Decide with Julian.

## 8. Text message templates (from the prototype)

- **Code:** `Lookout: {owner} wants to add you as a photo watcher. Your code is {code}. Give it to {owner} to confirm. Reply STOP to opt out.`
- **Confirmed:** `Lookout: You're confirmed. {owner} can now pick photos for you to watch.`
- **Test:** `Lookout test from {owner}: alerts to this number are working. You don't need to reply.`
- **Added:** `Lookout: {owner} made you a watcher on {a photo | N photos}. You'll get a text if {it's | any of them is} shared, downloaded or screenshotted.`
- **Removed:** `Lookout alert: {owner} removed you as a watcher on {a photo | N photos}. You won't be told about {it | them} anymore.`
- **Share:** `Lookout alert: {actor} shared a photo you're watching with {recipient}.`
- **Download:** `Lookout alert: {actor} downloaded a photo you're watching. It's now saved outside the app.`
- **Screenshot:** `Lookout alert: {actor} took a screenshot of a photo you're watching.`
- **Delete:** `Lookout alert: {actor} deleted a photo you were watching.`
- **When the actor isn't the owner,** the actor is written as `{actor} (someone {owner} shared it with)`.

## 9. Open questions for Julian

1. Who is this mainly for? (Couples, friends sharing private photos, parents and kids, holding yourself accountable?) The answer shapes the onboarding and the App Store pitch.
2. Should downloads be **blocked** or **allowed with an alert**?
3. Can people a photo was shared with **re-share** it?
4. Should the photo owner also get a push notification when a recipient does something?
5. Sign-in: username + PIN (prototype), or **phone number + texted code** (more typical, and reuses Twilio)?
6. iPhone only first, or Android too?
7. Should screen *recording* also trigger alerts? (iOS can detect it.)

## 10. Build plan (milestones)

1. **Skeleton:** Expo app with tabs (Photos / Watchers / Texts) and Supabase auth. Julian runs it in Expo Go on his iPhone.
2. **Photos:** upload from the camera roll to private storage, a grid, a full-screen viewer, and blocking long-press save.
3. **Watchers:** add a number, text a code (Twilio trial), verify it, send a test text, remove.
4. **Per-photo watchers:** the picker sheet after upload and from the viewer, with added/removed texts.
5. **Events:** share (in-app), download, screenshot detection, delete. Every event goes through `report-event` to SMS.
6. **Safety and polish:** delete-originals prompt, blur in the background, Texts history, empty states, error handling, haptics.
7. **Store readiness:** privacy policy, in-app account deletion, app icon and screenshots, TestFlight with friends.
8. **Launch:** Apple Developer Program ($99/yr), Twilio A2P 10DLC registration (US carriers filter unregistered business texts), then submit with EAS.

**App Review notes:** Apple looks closely at apps that monitor people. Present Lookout as something you choose to use on your own photos. Watchers have to opt in (the code step) and must be able to opt out (STOP), which also matters for US texting law.

## 11. Ideas for making it better (Julian asked for "smoother")

- An onboarding flow: name, then add your first watcher, then upload your first photo.
- Watcher **groups** (e.g., "Family") for faster assignment.
- Albums, with watchers assigned per album.
- Delivery status on each text (Twilio status callback), and retries.
- A short undo window before removal texts go out.
- A dark mode that matches the system.

## 12. The prototype

- **Live version** (private to Julian): https://claude.ai/artifact/CoXS2tZyBVR7VnJEyMuzDc
- It's a single HTML file (full source below). All accounts live on one device so you can test both sides. Texts are **simulated**: they appear in the Texts tab instead of being sent. Screenshot is a test button, because web pages can't detect screenshots. It uses a Claude-hosted storage API (`window.claude.use("db" | "assets" | "downloads")`) that won't exist outside claude.ai, so **treat it as a UX and behavior reference, not code to port directly.** Without that API, it runs in memory if you open the file locally in a browser.

---

## Appendix: prototype source (`lookout.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Lookout</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#f5f5f7;--card:#fff;--ink:#16161d;--muted:#6b6b78;--line:#e6e6ec;
  --accent:#4f46e5;--accent-soft:#eef0ff;--warn:#b45309;--warn-soft:#fff7e6;
  --ok:#047857;--ok-soft:#e8f8f1;--danger:#dc2626;--danger-soft:#fdecec;
  --r:16px;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.4}
body{padding:env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left)}
button,input{font:inherit;color:inherit}
button{cursor:pointer;border:0;background:none}
#app{max-width:560px;margin:0 auto;min-height:100vh;padding-bottom:calc(84px + env(safe-area-inset-bottom))}
.top{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 10px}
.top h1{font-size:26px;font-weight:800;margin:0;letter-spacing:-.02em}
.avatar{width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;display:grid;place-items:center;font-size:14px}
.wrap{padding:0 16px}
.card{background:var(--card);border-radius:var(--r);padding:16px;margin-bottom:12px;border:1px solid var(--line)}
.card h3{margin:0 0 6px;font-size:16px}
.muted{color:var(--muted)}
.small{font-size:13px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 16px;border-radius:12px;font-weight:600;background:var(--accent);color:#fff}
.btn.full{width:100%}
.btn.ghost{background:var(--accent-soft);color:var(--accent)}
.btn.plain{background:#f0f0f4;color:var(--ink)}
.btn.danger{background:var(--danger-soft);color:var(--danger)}
.btn.sm{padding:7px 12px;font-size:13px;border-radius:10px}
.btn:disabled{opacity:.5}
.field{display:block;margin-bottom:12px}
.field span{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:var(--muted)}
.input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line);background:#fafafc;outline:none}
.input:focus{border-color:var(--accent);background:#fff}
.row{display:flex;gap:8px;align-items:center}
.row .input{flex:1}
.banner{border-radius:var(--r);padding:14px 16px;margin-bottom:12px;font-size:14px}
.banner.warn{background:var(--warn-soft);color:var(--warn)}
.banner.info{background:var(--accent-soft);color:#3730a3}
.banner b{display:block;margin-bottom:2px}
.sec{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin:20px 4px 10px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;border-radius:var(--r);overflow:hidden}
.tile{aspect-ratio:1;background:#ddd center/cover no-repeat;position:relative}
.tile .tag{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:2px 6px;border-radius:6px}
.empty{text-align:center;padding:28px 16px;color:var(--muted)}
.upload{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border-radius:var(--r);background:var(--accent);color:#fff;font-weight:700;cursor:pointer}
.upload input{display:none}
.item{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-top:1px solid var(--line)}
.item:first-child{border-top:0;padding-top:0}
.item:last-child{padding-bottom:0}
.ico{flex:none;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-size:18px;background:#f0f0f4}
.ico.red{background:var(--danger-soft)}.ico.ok{background:var(--ok-soft)}.ico.blue{background:var(--accent-soft)}
.item .body{flex:1;min-width:0}
.item .t{font-weight:600}
.dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex:none;margin-top:6px}
.pill{display:inline-block;font-size:12px;font-weight:600;padding:3px 8px;border-radius:999px}
.pill.ok{background:var(--ok-soft);color:var(--ok)}
.pill.wait{background:var(--warn-soft);color:var(--warn)}
.code{font-size:26px;font-weight:800;letter-spacing:.2em;margin:6px 0 2px;font-variant-numeric:tabular-nums}
.thumb{width:44px;height:44px;border-radius:10px;background:#ddd center/cover;flex:none}
.tabs{position:fixed;left:0;right:0;bottom:0;background:rgba(255,255,255,.94);backdrop-filter:blur(12px);border-top:1px solid var(--line);padding:6px 0 calc(6px + env(safe-area-inset-bottom));z-index:5}
.tabs .in{max-width:560px;margin:0 auto;display:flex}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;font-size:11px;font-weight:600;color:var(--muted);position:relative}
.tab .i{font-size:20px;line-height:1}
.tab.on{color:var(--accent)}
.badge{position:absolute;top:2px;left:calc(50% + 6px);background:var(--danger);color:#fff;font-size:10px;font-weight:700;min-width:17px;height:17px;border-radius:9px;display:grid;place-items:center;padding:0 4px}
.seg{display:flex;background:#ececf1;border-radius:12px;padding:3px;margin-bottom:16px}
.seg button{flex:1;padding:9px;border-radius:10px;font-weight:600;color:var(--muted)}
.seg button.on{background:#fff;color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}
.hero{text-align:center;padding:40px 20px 24px}
.hero .logo{width:64px;height:64px;border-radius:20px;background:var(--accent);display:grid;place-items:center;margin:0 auto 14px;font-size:32px}
.hero h1{margin:0;font-size:30px;font-weight:800;letter-spacing:-.02em}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.chip{padding:6px 10px;border-radius:999px;background:#f0f0f4;font-size:13px;font-weight:600}
.err{color:var(--danger);font-size:13px;margin:-4px 0 10px}
/* viewer */
.viewer{position:fixed;inset:0;background:#000;z-index:20;display:flex;flex-direction:column;color:#fff}
.viewer .vt{display:flex;align-items:center;gap:12px;padding:calc(12px + env(safe-area-inset-top)) 16px 12px}
.viewer .vt button{color:#fff;font-size:22px;width:36px}
.viewer .pic{flex:1;background:center/contain no-repeat;margin:0 8px;transition:filter .2s}
.viewer .acts{display:flex;justify-content:space-around;padding:14px 8px calc(14px + env(safe-area-inset-bottom))}
.viewer .acts button{color:#fff;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;font-weight:600;min-width:64px}
.viewer .acts .i{font-size:22px}
.viewer .watch{text-align:center;font-size:12px;color:#aaa;padding:0 16px}
body.shield .viewer .pic,body.shield .tile{filter:blur(24px)}
.pic,.tile{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}
/* sheet */
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:30;display:flex;align-items:flex-end;justify-content:center}
.sheet{background:#fff;width:100%;max-width:560px;border-radius:22px 22px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom));max-height:85vh;overflow:auto}
.sheet h2{margin:0 0 4px;font-size:20px}
.pick{display:flex;align-items:center;gap:12px;width:100%;padding:12px 4px;border-top:1px solid var(--line);text-align:left}
.pick:first-of-type{border-top:0}
.toast{position:fixed;left:50%;transform:translateX(-50%);top:calc(16px + env(safe-area-inset-top));bottom:auto;margin-bottom:0;--b:calc(96px + env(safe-area-inset-bottom));background:#16161d;color:#fff;padding:12px 16px;border-radius:14px;font-size:14px;font-weight:500;z-index:50;max-width:92vw;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:up .2s ease}
@keyframes up{from{opacity:0;transform:translate(-50%,-8px)}to{opacity:1;transform:translate(-50%,0)}}
.loading{display:grid;place-items:center;min-height:70vh;color:var(--muted)}
.tile .tag.dim{background:rgba(180,83,9,.85)}
.sms{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:12px 14px;margin-bottom:10px;display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:start}
.sms .to{grid-column:1/-1;font-size:13px;color:var(--muted);display:flex;gap:4px}
.sms .to b{color:var(--ink)}
.sms .to span{margin-left:auto}
.bubble{background:#e9e9ef;border-radius:18px 18px 18px 4px;padding:10px 14px;font-size:15px}
.bubble.alert{background:#ffe9e9}
.check{width:24px;height:24px;border-radius:7px;border:2px solid #c7c7d1;display:grid;place-items:center;font-weight:800;color:#fff;flex:none}
.check.on{background:var(--accent);border-color:var(--accent)}
</style>
</head>
<body>
<div id="app"><div class="loading">Loading…</div></div>
<div id="layer"></div>
<script>
(function(){
"use strict";

// ---------- state ----------
// people = phone numbers you can assign to photos; texts = every text the app sends
const S = { accounts: [], photos: [], people: [], texts: [], session: null };
let view = "photos", authTab = "in", authErr = "", peopleErr = "", lastUser = "";
let docRef = null, assets = null, downloads = null, mode = "loading";
let viewerId = null, sheet = null, pickIds = [], pickSel = new Set();
const localBlobs = new Map();

const $app = document.getElementById("app"), $layer = document.getElementById("layer");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => Date.now();
const me = () => S.accounts.find(a => a.id === S.session) || null;
const acct = id => S.accounts.find(a => a.id === id);
const nameOf = id => (acct(id) || {}).name || "Someone";
const person = id => S.people.find(p => p.id === id);
const initials = n => (n || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
const photoUrl = p => p.assetId ? "/_blob/" + p.assetId : (localBlobs.get(p.id) || "");
const myPeople = () => S.people.filter(p => p.ownerId === S.session);
const verifiedWatchers = photo => (photo.watchers || []).map(person).filter(p => p && p.status === "verified");
function fmtPhone(d){
  d = String(d || "").replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") d = d.slice(1);
  return d.length === 10 ? "(" + d.slice(0,3) + ") " + d.slice(3,6) + "-" + d.slice(6) : "+" + d;
}
function ago(t){ const s = (now() - t) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.floor(s/60) + "m ago"; if (s < 86400) return Math.floor(s/3600) + "h ago"; return Math.floor(s/86400) + "d ago"; }
async function hashPin(username, pin){
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("lookout:" + username + ":" + pin));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch(e){ return "plain:" + pin; }
}

// ---------- persistence ----------
let saveTimer = null, saveChain = Promise.resolve();
function persist(){
  if (!docRef) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const body = JSON.parse(JSON.stringify({
      v: 2, accounts: S.accounts, photos: S.photos.filter(p => p.assetId),
      people: S.people, texts: S.texts.slice(0, 400), session: S.session
    }));
    saveChain = saveChain.then(() => docRef.set(body)).catch(e => {
      toast(e && e.code === "quota_exceeded" ? "Storage is full, so this change wasn't saved." : "Couldn't save just now. Your last change may not stick.");
    });
  }, 400);
}

// ---------- texting (simulated outbox) ----------
function sendText(ownerId, p, body, photoId){
  S.texts.unshift({ id: uid(), ownerId, personId: p.id, name: p.name, phone: p.phone, body, at: now(), photoId: photoId || null });
}
// something happened to a photo -> text that photo's watchers only
function alertWatchers(actorId, type, photo, extra){
  const owner = nameOf(photo.ownerId), actor = nameOf(actorId), self = actorId === photo.ownerId;
  const who = self ? owner : actor + " (someone " + owner + " shared it with)";
  const msg = {
    share: who + " shared a photo you're watching with " + nameOf(extra && extra.target) + ".",
    download: who + " downloaded a photo you're watching. It's now saved outside the app.",
    screenshot: who + " took a screenshot of a photo you're watching.",
    delete: who + " deleted a photo you were watching."
  }[type];
  const list = verifiedWatchers(photo);
  list.forEach(p => sendText(photo.ownerId, p, "Lookout alert: " + msg, photo.id));
  persist();
  return list.length;
}

// ---------- render ----------
function render(){
  if (mode === "loading"){ $app.innerHTML = '<div class="loading">Loading…</div>'; return; }
  if (!me()){ renderAuth(); renderLayer(); return; }
  const u = me();
  const pending = myPeople().filter(p => p.status === "pending").length;
  let body = "";
  if (view === "photos") body = renderPhotos(u);
  if (view === "people") body = renderPeople(u);
  if (view === "texts") body = renderTexts(u);
  const title = { photos:"Photos", people:"Watchers", texts:"Texts sent" }[view];
  $app.innerHTML =
    '<div class="top"><h1>' + title + '</h1><button class="avatar" data-act="account" aria-label="Account">' + esc(initials(u.name)) + '</button></div>' +
    '<div class="wrap">' + (mode === "memory" ? '<div class="banner warn"><b>Not saving</b>Your data couldn\'t be loaded here, so anything you do resets when you close this page.</div>' : "") + body + '</div>' +
    '<nav class="tabs"><div class="in">' +
      tab("photos","🖼️","Photos",0) + tab("people","📱","Watchers",pending) + tab("texts","💬","Texts",0) +
    '</div></nav>';
  renderLayer();
}
function tab(id, i, label, n){
  return '<button class="tab' + (view === id ? " on" : "") + '" data-act="tab" data-v="' + id + '"><span class="i">' + i + '</span>' + label + (n ? '<span class="badge">' + n + '</span>' : "") + '</button>';
}

function renderAuth(){
  $app.innerHTML =
    '<div class="hero"><div class="logo">👁️</div><h1>Lookout</h1><p class="muted">Pick who watches each photo. If it gets shared, saved or screenshotted, they get a text.</p></div>' +
    '<div class="wrap"><div class="card">' +
      '<div class="seg"><button data-act="authtab" data-v="in" class="' + (authTab === "in" ? "on" : "") + '">Sign in</button><button data-act="authtab" data-v="up" class="' + (authTab === "up" ? "on" : "") + '">Create account</button></div>' +
      (authTab === "up" ?
        '<form data-form="signup">' +
          '<label class="field"><span>Your name</span><input class="input" name="name" autocomplete="off" required maxlength="30" placeholder="Julian"></label>' +
          '<label class="field"><span>Username</span><input class="input" name="username" autocomplete="off" autocapitalize="none" required maxlength="20" placeholder="julian"></label>' +
          '<label class="field"><span>4-digit PIN</span><input class="input" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required placeholder="••••" type="password"></label>' +
          (authErr ? '<div class="err">' + esc(authErr) + '</div>' : "") +
          '<button class="btn full" type="submit">Create account</button></form>'
      :
        '<form data-form="signin">' +
          '<label class="field"><span>Username</span><input class="input" name="username" id="si-user" autocomplete="off" autocapitalize="none" required value="' + esc(lastUser) + '"></label>' +
          '<label class="field"><span>PIN</span><input class="input" name="pin" inputmode="numeric" maxlength="4" required type="password" placeholder="••••"></label>' +
          (authErr ? '<div class="err">' + esc(authErr) + '</div>' : "") +
          '<button class="btn full" type="submit">Sign in</button>' +
          (S.accounts.length ? '<p class="small muted" style="margin:16px 0 0">Accounts on this device</p><div class="chips">' + S.accounts.map(a => '<button type="button" class="chip" data-act="fill" data-v="' + esc(a.username) + '">@' + esc(a.username) + '</button>').join("") + '</div>' : "") +
        '</form>') +
    '</div>' +
    '<div class="banner info"><b>How this test version works</b>Watchers are just phone numbers and don\'t need the app. Texts aren\'t really sent yet. Each one shows up in the Texts tab exactly as it would arrive on their phone.</div>' +
    '</div>';
}

function renderPhotos(u){
  const mine = S.photos.filter(p => p.ownerId === u.id);
  const shared = S.photos.filter(p => p.ownerId !== u.id && (p.sharedWith || []).includes(u.id));
  let h = '';
  if (!myPeople().some(p => p.status === "verified")) h += '<div class="banner warn"><b>Add a watcher first</b>Add someone\'s phone number and confirm it with the code we text them. Then you can assign them to photos.<div style="margin-top:10px"><button class="btn sm ghost" data-act="tab" data-v="people">Add a phone number</button></div></div>';
  h += '<label class="upload">＋ Upload from camera roll<input type="file" accept="image/*" multiple data-act="upload"></label>';
  h += '<div class="sec">My photos · ' + mine.length + '</div>';
  h += mine.length ? '<div class="grid">' + mine.map(p => { const n = verifiedWatchers(p).length; return tile(p, n ? "👁 " + n : "No watchers", !n); }).join("") + '</div>' : '<div class="card empty">No photos yet. Upload one to start.</div>';
  if (shared.length) h += '<div class="sec">Shared with me · ' + shared.length + '</div><div class="grid">' + shared.map(p => tile(p, "from " + nameOf(p.ownerId))).join("") + '</div>';
  h += '<p class="small muted" style="text-align:center;margin:20px 8px">Tap a photo to choose who watches it.</p>';
  return h;
}
function tile(p, tag, dim){
  return '<button class="tile" data-act="open" data-v="' + p.id + '" style="background-image:url(\'' + photoUrl(p) + '\')" aria-label="Open photo">' + (tag ? '<span class="tag' + (dim ? " dim" : "") + '">' + esc(tag) + '</span>' : "") + '</button>';
}

function renderPeople(u){
  const list = myPeople();
  let h = '<div class="card"><h3>Add a watcher</h3><p class="small muted" style="margin:0 0 12px">They don\'t need the app. We text them a 6-digit code. Ask them for it and enter it to confirm the number works.</p>' +
    '<form data-form="addperson"><label class="field"><span>Name</span><input class="input" name="name" placeholder="Mom" autocomplete="off" required maxlength="30"></label>' +
    '<label class="field"><span>Phone number</span><input class="input" name="phone" type="tel" inputmode="tel" placeholder="(555) 123-4567" autocomplete="off" required></label>' +
    (peopleErr ? '<div class="err">' + esc(peopleErr) + '</div>' : "") +
    '<button class="btn full" type="submit">Text them a code</button></form></div>';
  h += '<div class="sec">My watchers · ' + list.length + '</div>';
  if (!list.length) h += '<div class="card empty">No one yet.</div>';
  else h += '<div class="card">' + list.map(p => {
    const watching = S.photos.filter(ph => ph.ownerId === u.id && (ph.watchers || []).includes(p.id)).length;
    if (p.status === "pending") return '<div class="item"><div class="avatar" style="background:#c7c7d1">' + esc(initials(p.name)) + '</div><div class="body"><div class="t">' + esc(p.name) + ' <span class="pill wait">Waiting for code</span></div><div class="small muted">' + esc(fmtPhone(p.phone)) + '</div>' +
      '<form data-form="verify" data-v="' + p.id + '" class="row" style="margin-top:10px"><input class="input" name="code" inputmode="numeric" maxlength="6" placeholder="Code they got" required><button class="btn sm" type="submit">Confirm</button></form>' +
      '<div class="row" style="margin-top:8px"><button class="btn sm plain" data-act="resend" data-v="' + p.id + '">Text a new code</button><button class="btn sm danger" data-act="removeperson" data-v="' + p.id + '">Remove</button></div></div></div>';
    return '<div class="item"><div class="avatar">' + esc(initials(p.name)) + '</div><div class="body"><div class="t">' + esc(p.name) + ' <span class="pill ok">Confirmed</span></div><div class="small muted">' + esc(fmtPhone(p.phone)) + ' · watching ' + watching + (watching === 1 ? " photo" : " photos") + '</div>' +
      '<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="test" data-v="' + p.id + '">Send test text</button><button class="btn sm danger" data-act="removeperson" data-v="' + p.id + '">Remove</button></div></div></div>';
  }).join("") + '</div>';
  return h;
}

function renderTexts(u){
  const list = S.texts.filter(t => t.ownerId === u.id);
  let h = '<div class="banner info"><b>Test mode</b>These texts aren\'t really sent yet. This is exactly what each person would get on their phone.</div>';
  if (!list.length) return h + '<div class="card empty">No texts yet.</div>';
  return h + list.map(t => {
    const ph = t.photoId ? S.photos.find(q => q.id === t.photoId) : null;
    const alert = /^Lookout alert/.test(t.body);
    return '<div class="sms"><div class="to"><b>' + esc(t.name) + '</b> · ' + esc(fmtPhone(t.phone)) + '<span>' + ago(t.at) + '</span></div>' +
      '<div class="bubble' + (alert ? " alert" : "") + '">' + esc(t.body) + '</div>' +
      (ph && photoUrl(ph) ? '<div class="thumb" style="background-image:url(\'' + photoUrl(ph) + '\')"></div>' : "") + '</div>';
  }).join("");
}

function renderLayer(){
  let h = "";
  const u = me();
  if (viewerId && u){
    const p = S.photos.find(q => q.id === viewerId);
    if (!p) viewerId = null;
    else {
      const own = p.ownerId === u.id, w = verifiedWatchers(p);
      h += '<div class="viewer"><div class="vt"><button data-act="close" aria-label="Close">✕</button><div><div style="font-weight:600">' + (own ? "Your photo" : esc(nameOf(p.ownerId)) + "'s photo") + '</div><div class="small" style="color:#aaa">Added ' + ago(p.at) + '</div></div></div>' +
        '<div class="pic" style="background-image:url(\'' + photoUrl(p) + '\')"></div>' +
        '<div class="watch">' + (w.length ? "👁 If anything happens to this photo, " + esc(w.map(x => x.name).join(", ")) + (w.length === 1 ? " gets" : " get") + " a text." : (own ? "No one is watching this photo. Tap Watchers to pick someone." : "No one is watching this photo.")) + '</div>' +
        '<div class="acts">' +
          (own ? '<button data-act="watchers"><span class="i">👁</span>Watchers</button>' : "") +
          (own ? '<button data-act="share"><span class="i">📤</span>Share</button>' : "") +
          '<button data-act="download"><span class="i">⬇️</span>' + (downloads ? "Download" : "Download (sim)") + '</button>' +
          '<button data-act="screenshot"><span class="i">📸</span>Screenshot<br><span style="font-weight:400;color:#aaa">(test)</span></button>' +
          (own ? '<button data-act="delete"><span class="i">🗑️</span>Delete</button>' : "") +
        '</div></div>';
    }
  }
  if (sheet === "pick" && u){
    const verified = myPeople().filter(p => p.status === "verified"), many = pickIds.length > 1;
    h += '<div class="scrim" data-act="closesheet"><div class="sheet"><h2>Who watches ' + (many ? "these " + pickIds.length + " photos" : "this photo") + '?</h2><p class="small muted" style="margin:0 0 12px">They get a text if ' + (many ? "any of them is" : "it's") + ' shared, downloaded or screenshotted. Anyone you add or remove gets a text about it too.</p>' +
      (verified.length ? verified.map(p => '<button class="pick" data-act="toggle" data-v="' + p.id + '"><span class="check' + (pickSel.has(p.id) ? " on" : "") + '">' + (pickSel.has(p.id) ? "✓" : "") + '</span><div><div style="font-weight:600">' + esc(p.name) + '</div><div class="small muted">' + esc(fmtPhone(p.phone)) + '</div></div></button>').join("")
        : '<div class="empty">You don\'t have any confirmed watchers yet.<div style="margin-top:10px"><button class="btn sm ghost" data-act="gopeople">Add a phone number</button></div></div>') +
      '<div class="row" style="margin-top:12px"><button class="btn plain full" data-act="closesheet">' + (verified.length ? "Cancel" : "Close") + '</button>' + (verified.length ? '<button class="btn full" data-act="savepick">Save</button>' : "") + '</div></div></div>';
  }
  if (sheet === "share" && u){
    const p = S.photos.find(q => q.id === viewerId);
    const people = S.accounts.filter(a => a.id !== u.id && p && !(p.sharedWith || []).includes(a.id));
    h += '<div class="scrim" data-act="closesheet"><div class="sheet"><h2>Share with…</h2><p class="small muted" style="margin:0 0 12px">This photo\'s watchers will get a text.</p>' +
      (people.length ? people.map(a => '<button class="pick" data-act="sharewith" data-v="' + a.id + '"><div class="avatar">' + esc(initials(a.name)) + '</div><div><div style="font-weight:600">' + esc(a.name) + '</div><div class="small muted">@' + esc(a.username) + '</div></div></button>').join("") : '<div class="empty">No one else uses the app on this device yet. Create a second account to test sharing.</div>') +
      '<button class="btn plain full" style="margin-top:12px" data-act="closesheet">Cancel</button></div></div>';
  }
  if (sheet === "delete"){
    h += '<div class="scrim" data-act="closesheet"><div class="sheet"><h2>Delete this photo?</h2><p class="muted">Its watchers will get a text saying it was deleted.</p><div class="row"><button class="btn plain full" data-act="closesheet">Cancel</button><button class="btn full" style="background:var(--danger)" data-act="confirmdelete">Delete</button></div></div></div>';
  }
  if (sheet === "account" && u){
    h += '<div class="scrim" data-act="closesheet"><div class="sheet"><div class="row" style="margin-bottom:16px"><div class="avatar" style="width:48px;height:48px;font-size:18px">' + esc(initials(u.name)) + '</div><div><h2>' + esc(u.name) + '</h2><div class="muted">@' + esc(u.username) + '</div></div></div>' +
      '<button class="btn ghost full" data-act="signout">Sign out / switch account</button>' +
      '<button class="btn danger full" style="margin-top:8px" data-act="askreset">Reset everything</button>' +
      '<button class="btn plain full" style="margin-top:8px" data-act="closesheet">Close</button></div></div>';
  }
  if (sheet === "reset"){
    h += '<div class="scrim" data-act="closesheet"><div class="sheet"><h2>Reset everything?</h2><p class="muted">This deletes every account, watcher, text and photo in this test version.</p><div class="row"><button class="btn plain full" data-act="closesheet">Cancel</button><button class="btn full" style="background:var(--danger)" data-act="confirmreset">Reset</button></div></div></div>';
  }
  $layer.innerHTML = h;
}

let toastTimer = null;
function toast(msg){
  clearTimeout(toastTimer);
  let t = document.getElementById("toast");
  if (!t){ t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  toastTimer = setTimeout(() => t.remove(), 3400);
}
const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

// ---------- actions ----------
async function compress(file){
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return (await new Promise(r => c.toBlob(r, "image/jpeg", 0.85))) || file;
  } catch(e){ return file; }
}

async function doUpload(files){
  const u = me(); if (!u || !files.length) return;
  toast("Uploading " + plural(files.length, "photo") + "…");
  const ids = []; let local = false;
  for (const f of files){
    if (f.type && !/^image\//.test(f.type)) continue;
    const blob = await compress(f);
    const p = { id: uid(), ownerId: u.id, at: now(), sharedWith: [], watchers: [], assetId: null };
    try { if (assets){ const r = await assets.upload(blob); p.assetId = r.id; } } catch(e){}
    if (!p.assetId){ localBlobs.set(p.id, URL.createObjectURL(blob)); local = true; }
    S.photos.unshift(p); ids.push(p.id);
  }
  if (!ids.length){ toast("Those files weren't photos."); return; }
  persist();
  pickIds = ids; pickSel = new Set(); sheet = "pick";
  render();
  if (local) toast("Added, but only until you close this page.");
}

// apply the watcher picker to pickIds; text anyone newly added or removed
function savePick(){
  const u = me(); if (!u) return;
  const added = new Map(), removed = new Map();
  pickIds.forEach(id => {
    const ph = S.photos.find(q => q.id === id); if (!ph) return;
    const before = new Set(ph.watchers || []);
    pickSel.forEach(pid => { if (!before.has(pid)) added.set(pid, (added.get(pid) || 0) + 1); });
    before.forEach(pid => { if (!pickSel.has(pid)) removed.set(pid, (removed.get(pid) || 0) + 1); });
    ph.watchers = Array.from(pickSel);
  });
  const one = pickIds.length === 1 ? pickIds[0] : null;
  added.forEach((n, pid) => { const p = person(pid); if (p) sendText(u.id, p, "Lookout: " + u.name + " made you a watcher on " + (n === 1 ? "a photo" : n + " photos") + ". You'll get a text if " + (n === 1 ? "it's" : "any of them is") + " shared, downloaded or screenshotted.", one); });
  removed.forEach((n, pid) => { const p = person(pid); if (p && p.status === "verified") sendText(u.id, p, "Lookout alert: " + u.name + " removed you as a watcher on " + (n === 1 ? "a photo" : n + " photos") + ". You won't be told about " + (n === 1 ? "it" : "them") + " anymore.", one); });
  sheet = null; persist(); render();
  const msgs = [];
  if (added.size) msgs.push("Texted " + plural(added.size, "new watcher"));
  if (removed.size) msgs.push("texted " + plural(removed.size, "removed watcher"));
  toast(msgs.length ? msgs.join(", ") + "." : (pickSel.size ? "Saved." : "No watchers on " + (one ? "this photo" : "these photos") + "."));
}

async function getBlob(p){
  const url = photoUrl(p);
  try { const r = await fetch(url); if (r.ok) return await r.blob(); } catch(e){}
  return await new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0); c.toBlob(b => b ? res(b) : rej(), "image/jpeg", 0.92); };
    img.onerror = rej; img.src = url;
  });
}
const sentMsg = n => n ? "Texted " + plural(n, "watcher") + "." : "This photo has no watchers, so no one was texted.";
async function doDownload(){
  const u = me(), p = S.photos.find(q => q.id === viewerId); if (!u || !p) return;
  if (!downloads){ const n = alertWatchers(u.id, "download", p); render(); toast("Download simulated. " + sentMsg(n)); return; }
  let blob;
  try { blob = await getBlob(p); } catch(e){ toast("Couldn't prepare the file."); return; }
  try {
    await downloads.save({ filename: "lookout-photo.jpg", data: blob });
    const n = alertWatchers(u.id, "download", p); render(); toast("Saved. " + sentMsg(n));
  } catch(e){
    toast(e && e.code === "declined" ? "Download cancelled, so no one was texted." : "Couldn't download here.");
  }
}
function doScreenshot(){
  const u = me(), p = S.photos.find(q => q.id === viewerId); if (!u || !p) return;
  const n = alertWatchers(u.id, "screenshot", p); render(); toast("📸 Screenshot caught. " + sentMsg(n));
}

async function signUp(fd){
  const name = String(fd.get("name") || "").trim(), username = String(fd.get("username") || "").trim().toLowerCase().replace(/^@/, ""), pin = String(fd.get("pin") || "");
  const fail = m => { authErr = m; render(); };
  if (!name) return fail("Enter your name.");
  if (!/^[a-z0-9_.]{2,20}$/.test(username)) return fail("Usernames use 2–20 letters, numbers, dots or underscores.");
  if (!/^\d{4}$/.test(pin)) return fail("The PIN needs exactly 4 digits.");
  if (S.accounts.some(a => a.username === username)) return fail("That username is taken.");
  const a = { id: uid(), name, username, pinHash: await hashPin(username, pin), at: now() };
  S.accounts.push(a); S.session = a.id; authErr = ""; view = "people";
  persist(); render(); toast("Welcome, " + name + "! Add your first watcher.");
}
async function signIn(fd){
  const username = String(fd.get("username") || "").trim().toLowerCase().replace(/^@/, ""), pin = String(fd.get("pin") || "");
  lastUser = username;
  const a = S.accounts.find(x => x.username === username);
  if (!a || a.pinHash !== await hashPin(username, pin)){ authErr = "Wrong username or PIN."; render(); return; }
  S.session = a.id; authErr = ""; view = "photos"; persist(); render();
}
function textCode(p){
  p.code = String(Math.floor(100000 + Math.random() * 900000));
  sendText(p.ownerId, p, "Lookout: " + nameOf(p.ownerId) + " wants to add you as a photo watcher. Your code is " + p.code + ". Give it to " + nameOf(p.ownerId) + " to confirm.");
}
function addPerson(fd){
  const u = me();
  const name = String(fd.get("name") || "").trim(), digits = String(fd.get("phone") || "").replace(/\D/g, "");
  const fail = m => { peopleErr = m; render(); };
  if (!name) return fail("Enter their name.");
  if (digits.length < 10 || digits.length > 15) return fail("That doesn't look like a full phone number.");
  const phone = digits.length === 10 ? "1" + digits : digits;
  if (myPeople().some(p => p.phone === phone)) return fail("That number is already on your list.");
  const p = { id: uid(), ownerId: u.id, name, phone, status: "pending", at: now() };
  S.people.push(p); textCode(p); peopleErr = "";
  persist(); render(); toast("Code texted to " + name + ". Check the Texts tab to see it.");
}
function verify(id, fd){
  const p = person(id); if (!p) return;
  if (String(fd.get("code") || "").trim() !== p.code){ toast("That code doesn't match. Check with " + p.name + "."); return; }
  p.status = "verified"; delete p.code;
  sendText(p.ownerId, p, "Lookout: You're confirmed. " + nameOf(p.ownerId) + " can now pick photos for you to watch.");
  persist(); render(); toast(p.name + " is confirmed. Now assign them to photos.");
}

// ---------- events ----------
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (act === "closesheet" && el.classList.contains("scrim") && e.target !== el) return; // tap inside a sheet
  const u = me();
  switch (act){
    case "tab": view = v; peopleErr = ""; render(); window.scrollTo(0, 0); break;
    case "authtab": authTab = v; authErr = ""; render(); break;
    case "fill": { const i = document.getElementById("si-user"); if (i){ i.value = v; const pin = i.form.querySelector("[name=pin]"); pin && pin.focus(); } break; }
    case "account": sheet = "account"; renderLayer(); break;
    case "closesheet": sheet = null; renderLayer(); break;
    case "gopeople": sheet = null; viewerId = null; view = "people"; render(); break;
    case "signout": S.session = null; sheet = null; viewerId = null; authTab = "in"; persist(); render(); break;
    case "askreset": sheet = "reset"; renderLayer(); break;
    case "confirmreset":
      S.accounts = []; S.photos = []; S.people = []; S.texts = []; S.session = null; sheet = null; viewerId = null; authTab = "up";
      persist(); render(); toast("Everything was reset."); break;
    case "open": viewerId = v; renderLayer(); break;
    case "close": viewerId = null; sheet = null; render(); break;
    case "watchers": { const p = S.photos.find(q => q.id === viewerId); if (p){ pickIds = [p.id]; pickSel = new Set(verifiedWatchers(p).map(x => x.id)); sheet = "pick"; renderLayer(); } break; }
    case "toggle": pickSel.has(v) ? pickSel.delete(v) : pickSel.add(v); renderLayer(); break;
    case "savepick": savePick(); break;
    case "share": sheet = "share"; renderLayer(); break;
    case "sharewith": {
      const p = S.photos.find(q => q.id === viewerId); if (!p || !u) break;
      p.sharedWith = (p.sharedWith || []).concat(v);
      const n = alertWatchers(u.id, "share", p, { target: v });
      sheet = null; render(); toast("Shared with " + nameOf(v) + ". " + sentMsg(n));
      break;
    }
    case "download": doDownload(); break;
    case "screenshot": doScreenshot(); break;
    case "delete": sheet = "delete"; renderLayer(); break;
    case "confirmdelete": {
      const p = S.photos.find(q => q.id === viewerId); if (!p || !u) break;
      const n = alertWatchers(u.id, "delete", p);
      S.photos = S.photos.filter(q => q.id !== p.id);
      S.texts.forEach(t => { if (t.photoId === p.id) t.photoId = null; });
      if (p.assetId && assets) assets.delete(p.assetId).catch(() => {});
      viewerId = null; sheet = null; persist(); render(); toast("Deleted. " + sentMsg(n));
      break;
    }
    case "resend": { const p = person(v); if (p){ textCode(p); persist(); render(); toast("New code texted to " + p.name + "."); } break; }
    case "removeperson": {
      const p = person(v); if (!p) break;
      const count = S.photos.filter(ph => (ph.watchers || []).includes(v)).length;
      if (p.status === "verified") sendText(p.ownerId, p, "Lookout alert: " + nameOf(p.ownerId) + " removed you as a watcher" + (count ? " on " + plural(count, "photo") : "") + ". You won't get alerts from them anymore.");
      S.photos.forEach(ph => { ph.watchers = (ph.watchers || []).filter(x => x !== v); });
      S.people = S.people.filter(x => x.id !== v);
      persist(); render(); toast(p.status === "verified" ? p.name + " was removed and got a text about it." : "Removed.");
      break;
    }
    case "test": { const p = person(v); if (p){ sendText(p.ownerId, p, "Lookout test from " + nameOf(p.ownerId) + ": alerts to this number are working. You don't need to reply."); persist(); render(); toast("Test text sent to " + p.name + "."); } break; }
  }
});
document.addEventListener("submit", e => {
  e.preventDefault();
  const f = e.target, fd = new FormData(f);
  if (f.dataset.form === "signup") signUp(fd);
  if (f.dataset.form === "signin") signIn(fd);
  if (f.dataset.form === "addperson") addPerson(fd);
  if (f.dataset.form === "verify") verify(f.dataset.v, fd);
});
document.addEventListener("change", e => {
  if (e.target.dataset && e.target.dataset.act === "upload"){ const files = Array.from(e.target.files || []); e.target.value = ""; doUpload(files); }
});
document.addEventListener("contextmenu", e => { if (e.target.closest(".pic,.tile")) e.preventDefault(); });
document.addEventListener("keyup", e => { if (e.key === "PrintScreen" && viewerId) doScreenshot(); });
const shield = on => document.body.classList.toggle("shield", on);
document.addEventListener("visibilitychange", () => shield(document.hidden));
window.addEventListener("blur", () => shield(true));
window.addEventListener("focus", () => shield(false));

// ---------- boot ----------
(async function boot(){
  const fallback = setTimeout(() => { if (mode === "loading"){ mode = "memory"; render(); } }, 10000);
  try {
    const c = window.claude;
    if (c && c.use){
      const [db, user] = await Promise.all([c.use("db"), c.use("user")]);
      assets = await c.use("assets").catch(() => null);
      downloads = await c.use("downloads").catch(() => null);
      if (db && user){
        const id = await user.id();
        if (id){
          const ref = db.doc("data/users/" + id + "/app");
          const snap = await ref.get();
          if (snap.exists){
            const d = JSON.parse(JSON.stringify(snap.data() || {}));
            ["accounts","photos","people","texts"].forEach(k => { if (Array.isArray(d[k])) S[k] = d[k]; });
            S.photos.forEach(p => { if (!Array.isArray(p.watchers)) p.watchers = []; });
            S.session = d.session || null;
          }
          docRef = ref;
        }
      }
    }
  } catch(e){}
  clearTimeout(fallback);
  if (mode === "loading") mode = docRef ? "saved" : "memory";
  if (!S.accounts.length) authTab = "up";
  render();
})();
})();
</script>
</body>
</html>

```
