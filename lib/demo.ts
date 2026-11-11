// A stand-in for the Supabase backend, used when the app has no Supabase keys.
//
// The Supabase client is given demoFetch() in place of fetch(), so every screen
// runs its real code against this instead of a server. It keeps its data on the
// phone, never sends a text, and answers the same way the real database and
// server functions do (including their error sentences), so the demo behaves
// like the real app as closely as possible. Texts are recorded as 'simulated',
// exactly like the real server before Twilio is connected.

import {
  CODE_LIFETIME_MS,
  CODE_PROBLEMS,
  MAX_WRONG_TRIES,
  normalizeCode,
  wrongCodeMessage,
} from '@/supabase/functions/_shared/codes';
import { idList, MAX_PHOTOS_PER_CHANGE, planAssignments, type Assignment } from '@/supabase/functions/_shared/assign';
import { MAX_WATCHERS_PER_OWNER } from '@/supabase/functions/_shared/limits';
import {
  assignedText,
  BLOCKED_PHOTO,
  codeText,
  confirmedText,
  eventText,
  isPhotoEvent,
  leavesTheApp,
  removedText,
  testText,
  unassignedText,
} from '@/supabase/functions/_shared/messages';
import { parseNewWatcher } from '@/supabase/functions/_shared/watchers';

import { clearPhotos, loadPhotos, storePhoto } from './demoPhotos';
import { safeStorage } from './safeStorage';

export const DEMO_URL = 'https://demo.lookout.invalid';

type Row = Record<string, unknown> & { id: string };
type Code = { watcher_id: string; code: string; expires_at: number; attempts: number };

type Data = {
  users: Record<string, string>; // phone digits -> user id
  profiles: Row[];
  photos: Row[];
  watchers: Row[];
  texts: Row[];
  codes: Code[];
  photo_watchers: Assignment[];
};

const KEY = 'lookout-demo-v1';
const TABLES = ['profiles', 'photos', 'watchers', 'texts'] as const;
type Table = (typeof TABLES)[number];

const empty = (): Data => ({ users: {}, profiles: [], photos: [], watchers: [], texts: [], codes: [], photo_watchers: [] });

let data: Data | null = null;
let loading: Promise<Data> | null = null;
/** Storage path -> something an <Image> can show. */
const photoUris = new Map<string, string>();

function load(): Promise<Data> {
  if (data) return Promise.resolve(data);
  loading ??= (async () => {
    let parsed: Data = empty();
    try {
      const saved = await safeStorage.getItem(KEY);
      if (saved) parsed = { ...empty(), ...JSON.parse(saved) };
    } catch {}
    await loadPhotos(
      parsed.photos.map((p) => String(p.storage_path)),
      photoUris,
    );
    // A photo whose image didn't survive (web without IndexedDB) is dropped.
    parsed.photos = parsed.photos.filter((p) => photoUris.has(String(p.storage_path)));
    data = parsed;
    return parsed;
  })();
  return loading;
}

function save() {
  if (data) safeStorage.setItem(KEY, JSON.stringify(data));
}

/** Erases everything the demo has stored on this phone. */
export async function resetDemo(): Promise<void> {
  data = empty();
  photoUris.clear();
  await safeStorage.removeItem(KEY);
  await clearPhotos();
}

/** Called instead of uploading when the app is a demo. */
export async function demoSavePhoto(path: string, uri: string): Promise<void> {
  photoUris.set(path, await storePhoto(path, uri));
}

export function demoPhotoUri(path: string): string | null {
  return photoUris.get(path) ?? null;
}

// ---------- helpers ----------

const now = () => new Date().toISOString();

function uuid(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 32; i++) out += hex[Math.floor(Math.random() * 16)];
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-4${out.slice(13, 16)}-a${out.slice(17, 20)}-${out.slice(20)}`;
}

function reply(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const text = body === undefined ? null : JSON.stringify(body);
  return new Response(status === 204 ? null : text, {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

/** A Refusal, in the same shape the real server functions use. */
const refuse = (status: number, error: string) => reply({ error }, status);

function base64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sessionFor(userId: string, phone: string) {
  const expiresIn = 60 * 60 * 24 * 365;
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const user = {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    phone,
    app_metadata: { provider: 'phone' },
    user_metadata: {},
    created_at: now(),
  };
  const access_token = [
    base64url({ alg: 'none', typ: 'JWT' }),
    base64url({ sub: userId, phone, role: 'authenticated', aud: 'authenticated', exp: expiresAt }),
    'demo',
  ].join('.');
  return {
    access_token,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: expiresAt,
    refresh_token: `demo:${userId}`,
    user,
  };
}

/** Reads the signed-in user from the token the client sends. */
function callerId(headers: Headers): string | null {
  const token = (headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.sub === 'string' ? json.sub : null;
  } catch {
    return null;
  }
}

function phoneOf(db: Data, userId: string): string {
  return Object.keys(db.users).find((phone) => db.users[phone] === userId) ?? '';
}

// ---------- auth ----------

function auth(db: Data, path: string, method: string, body: any, headers: Headers): Response {
  if (path === 'otp') return reply({});
  if (path === 'verify') {
    const phone = String(body?.phone ?? '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(String(body?.token ?? ''))) {
      return reply({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }, 403);
    }
    db.users[phone] ??= uuid();
    save();
    return reply(sessionFor(db.users[phone], phone));
  }
  if (path === 'token') {
    const userId = String(body?.refresh_token ?? '').replace(/^demo:/, '');
    if (!Object.values(db.users).includes(userId)) {
      return reply({ code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }, 400);
    }
    return reply(sessionFor(userId, phoneOf(db, userId)));
  }
  if (path === 'user' && method === 'GET') {
    const userId = callerId(headers);
    if (!userId) return reply({ code: 401, msg: 'Not signed in' }, 401);
    return reply(sessionFor(userId, phoneOf(db, userId)).user);
  }
  if (path === 'logout') return reply(undefined, 204);
  return reply({ msg: 'Not available in the demo' }, 404);
}

// ---------- database (a small subset of PostgREST) ----------

/** Rows the caller may see, the same as the row-level security policies allow. */
function visible(db: Data, table: Table, userId: string): Row[] {
  if (table === 'profiles') return db.profiles.filter((r) => r.id === userId);
  const rows = db[table].filter((r) => r.owner_id === userId);
  return table === 'photos' ? rows.filter((r) => r.deleted_at == null) : rows;
}

function matches(row: Row, column: string, filter: string): boolean {
  const dot = filter.indexOf('.');
  const op = filter.slice(0, dot);
  const value = filter.slice(dot + 1);
  const actual = row[column];
  switch (op) {
    case 'eq':
      return String(actual) === value;
    case 'neq':
      return String(actual) !== value;
    case 'is':
      return value === 'null' ? actual == null : String(actual) === value;
    case 'in':
      return value.replace(/^\(|\)$/g, '').split(',').includes(String(actual));
    default:
      return true;
  }
}

const NOT_FILTERS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function query(rows: Row[], params: URLSearchParams): Row[] {
  let out = rows;
  params.forEach((filter, column) => {
    if (!NOT_FILTERS.has(column)) out = out.filter((r) => matches(r, column, filter));
  });
  const order = params.get('order');
  if (order) {
    const [column, direction] = order.split('.');
    const sign = direction === 'desc' ? -1 : 1;
    out = [...out].sort((a, b) => (String(a[column]) < String(b[column]) ? -sign : sign));
  }
  const limit = Number(params.get('limit'));
  if (limit > 0) out = out.slice(0, limit);
  const select = params.get('select');
  if (select && select !== '*') {
    const columns = select.split(',').map((c) => c.trim());
    out = out.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null])) as Row);
  }
  return out;
}

function respondRows(rows: Row[], headers: Headers): Response {
  if ((headers.get('Accept') ?? '').includes('vnd.pgrst.object')) {
    if (rows.length !== 1) {
      return reply(
        { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
        406,
      );
    }
    return reply(rows[0]);
  }
  return reply(rows);
}

/** What the app itself may write. Everything else goes through a server function. */
function insertable(table: Table, row: Row, userId: string): boolean {
  if (table === 'profiles') return row.id === userId;
  if (table === 'photos') return row.owner_id === userId;
  return false;
}

function rest(
  db: Data,
  table: string,
  method: string,
  params: URLSearchParams,
  body: any,
  headers: Headers,
): Response {
  const userId = callerId(headers);
  if (!userId) return reply({ message: 'Not signed in' }, 401);
  if (table === 'photo_watchers') {
    // Read-only for the app, and only for the caller's own watchers.
    if (method !== 'GET') return reply({ message: 'Not available in the demo' }, 405);
    const mine = new Set(db.watchers.filter((w) => w.owner_id === userId).map((w) => w.id));
    return reply(db.photo_watchers.filter((a) => mine.has(a.watcher_id)));
  }
  if (!TABLES.includes(table as Table)) return reply({ message: 'Unknown table' }, 404);
  const name = table as Table;

  if (method === 'GET' || method === 'HEAD') {
    return respondRows(query(visible(db, name, userId), params), headers);
  }

  if (method === 'POST') {
    const prefer = headers.get('Prefer') ?? '';
    const incoming = (Array.isArray(body) ? body : [body]) as Record<string, unknown>[];
    const written: Row[] = [];
    for (const raw of incoming) {
      const row = {
        id: uuid(),
        created_at: now(),
        ...(name === 'photos' ? { deleted_at: null } : {}),
        ...raw,
      } as Row;
      if (!insertable(name, row, userId)) {
        return reply({ code: '42501', message: `new row violates row-level security policy for table "${name}"` }, 403);
      }
      const existing = db[name].findIndex((r) => r.id === row.id);
      if (existing >= 0) {
        if (!prefer.includes('merge-duplicates')) {
          return reply({ code: '23505', message: 'duplicate key value' }, 409);
        }
        db[name][existing] = { ...db[name][existing], ...raw, id: row.id };
        written.push(db[name][existing]);
      } else {
        db[name].push(row);
        written.push(row);
      }
    }
    save();
    if (!prefer.includes('return=representation')) return reply(undefined, 201);
    return respondRows(query(written, params), headers);
  }

  return reply({ message: 'Not available in the demo' }, 405);
}

// ---------- server functions ----------

function addText(db: Data, ownerId: string, watcher: Row, body: string) {
  db.texts.push({
    id: uuid(),
    owner_id: ownerId,
    watcher_id: watcher.id,
    watcher_name: watcher.name,
    watcher_phone: watcher.phone_e164,
    event_id: null,
    body,
    twilio_sid: null,
    status: 'simulated',
    // Distinct times keep the Texts tab in the order the texts were "sent".
    created_at: new Date(Date.now() + db.texts.length).toISOString(),
  });
}

function forApp(w: Row) {
  const { owner_id: _owner, ...fields } = w;
  return fields;
}

function sendCode(db: Data, ownerId: string, owner: string, watcher: Row) {
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  db.codes = db.codes.filter((c) => c.watcher_id !== watcher.id);
  db.codes.push({ watcher_id: watcher.id, code, expires_at: Date.now() + CODE_LIFETIME_MS, attempts: 0 });
  // Like the real server in simulated mode, the code is shown so the demo can be finished alone.
  addText(db, ownerId, watcher, codeText(owner, code));
}

function functions(db: Data, name: string, input: any, headers: Headers): Response {
  const userId = callerId(headers);
  if (!userId) return refuse(401, 'Sign in again to continue.');
  const profile = db.profiles.find((p) => p.id === userId);
  if (!profile) return refuse(403, 'Finish setting up your account first.');
  const owner = String(profile.name);
  const mine = db.watchers.filter((w) => w.owner_id === userId);
  const find = () => mine.find((w) => w.id === input?.watcher_id);
  const gone = () => refuse(404, "That watcher isn't on your list anymore.");

  switch (name) {
    case 'send-watcher-code': {
      let watcher: Row | undefined;
      if (input?.watcher_id === undefined) {
        const parsed = parseNewWatcher(input ?? {});
        if ('error' in parsed) return refuse(400, parsed.error);
        if (mine.some((w) => w.phone_e164 === parsed.phone)) {
          return refuse(409, 'That number is already on your list.');
        }
        if (mine.length >= MAX_WATCHERS_PER_OWNER) {
          return refuse(409, `You can have up to ${MAX_WATCHERS_PER_OWNER} watchers. Remove one to add another.`);
        }
        watcher = {
          id: uuid(),
          owner_id: userId,
          name: parsed.name,
          phone_e164: parsed.phone,
          status: 'pending',
          verified_at: null,
          verified_simulated: false,
          created_at: now(),
        };
        db.watchers.push(watcher);
      } else {
        watcher = find();
        if (!watcher) return gone();
        if (watcher.status === 'verified') return refuse(409, `${watcher.name} is already confirmed.`);
        if (watcher.status === 'opted_out') {
          return refuse(409, `${watcher.name} replied STOP, so Lookout can't text them.`);
        }
      }
      sendCode(db, userId, owner, watcher);
      save();
      return reply({ watcher: forApp(watcher), simulated: true });
    }

    case 'verify-watcher-code': {
      const watcher = find();
      if (!watcher) return gone();
      const code = normalizeCode(input?.code);
      if (!code) return refuse(400, 'Enter the 6-digit code they got.');
      if (watcher.status === 'verified') return refuse(409, `${watcher.name} is already confirmed.`);
      const stored = db.codes.find((c) => c.watcher_id === watcher.id);
      if (!stored) return refuse(400, CODE_PROBLEMS.missing);
      if (stored.expires_at <= Date.now()) return refuse(400, CODE_PROBLEMS.expired);
      if (stored.attempts >= MAX_WRONG_TRIES) return refuse(429, CODE_PROBLEMS.locked);
      stored.attempts += 1;
      if (stored.code !== code) {
        save();
        return refuse(400, wrongCodeMessage(String(watcher.name), stored.attempts));
      }
      watcher.status = 'verified';
      watcher.verified_at = now();
      db.codes = db.codes.filter((c) => c.watcher_id !== watcher.id);
      addText(db, userId, watcher, confirmedText(owner));
      save();
      return reply({ watcher: forApp(watcher), simulated: true });
    }

    case 'send-test-text': {
      const watcher = find();
      if (!watcher) return gone();
      if (watcher.status !== 'verified') {
        return refuse(409, `Confirm ${watcher.name}'s number before sending a test.`);
      }
      addText(db, userId, watcher, testText(owner));
      save();
      return reply({ simulated: true });
    }

    case 'set-photo-watchers': {
      const photoIds = idList(input?.photo_ids, 1, MAX_PHOTOS_PER_CHANGE);
      const wanted = idList(input?.watcher_ids, 0, MAX_WATCHERS_PER_OWNER);
      if (!photoIds || !wanted) return refuse(400, "That request wasn't understood.");
      const photos = db.photos.filter((p) => p.owner_id === userId && p.deleted_at == null);
      if (!photoIds.every((id) => photos.some((p) => p.id === id))) {
        return refuse(404, "One of those photos isn't in your library anymore.");
      }
      const change = planAssignments(
        photoIds,
        db.photo_watchers.filter((a) => photoIds.includes(a.photo_id)),
        wanted,
      );
      for (const id of wanted) {
        const watcher = mine.find((w) => w.id === id);
        if (!watcher) return refuse(404, "One of those watchers isn't on your list anymore.");
        if (change.added.has(id) && watcher.status !== 'verified') {
          return refuse(409, `${watcher.name} hasn't confirmed their number, so they can't watch photos yet.`);
        }
      }
      const gone_ = new Set(change.remove.map((a) => `${a.photo_id}/${a.watcher_id}`));
      db.photo_watchers = db.photo_watchers
        .filter((a) => !gone_.has(`${a.photo_id}/${a.watcher_id}`))
        .concat(change.add);
      let added = 0;
      let removed = 0;
      for (const [id, count] of change.added) {
        const watcher = mine.find((w) => w.id === id);
        if (watcher?.status !== 'verified') continue;
        addText(db, userId, watcher, assignedText(owner, count));
        added += 1;
      }
      for (const [id, count] of change.removed) {
        const watcher = mine.find((w) => w.id === id);
        if (watcher?.status !== 'verified') continue;
        addText(db, userId, watcher, unassignedText(owner, count));
        removed += 1;
      }
      save();
      return reply({ added, removed });
    }

    case 'report-event': {
      const type = input?.type;
      if (!isPhotoEvent(type)) return refuse(400, "That request wasn't understood.");
      const photo = db.photos.find(
        (p) => p.id === input?.photo_id && p.owner_id === userId && p.deleted_at == null,
      );
      if (!photo) return refuse(404, "That photo isn't in your library anymore.");
      if (leavesTheApp(type) && photo.download_policy === 'blocked') return refuse(403, BLOCKED_PHOTO);
      const assigned = db.photo_watchers.filter((a) => a.photo_id === photo.id).map((a) => a.watcher_id);
      const tell = mine.filter((w) => w.status === 'verified' && assigned.includes(w.id));
      if (type === 'delete') {
        photo.deleted_at = now();
        db.photo_watchers = db.photo_watchers.filter((a) => a.photo_id !== photo.id);
      }
      for (const watcher of tell) addText(db, userId, watcher, eventText(owner, type));
      save();
      return reply({ texted: tell.length });
    }

    case 'remove-watcher': {
      const watcher = find();
      if (!watcher) return gone();
      const texted = watcher.status === 'verified';
      const watching = db.photo_watchers.filter((a) => a.watcher_id === watcher.id).length;
      if (texted) addText(db, userId, watcher, removedText(owner, watching));
      db.photo_watchers = db.photo_watchers.filter((a) => a.watcher_id !== watcher.id);
      db.watchers = db.watchers.filter((w) => w.id !== watcher.id);
      db.codes = db.codes.filter((c) => c.watcher_id !== watcher.id);
      save();
      return reply({ removed: true, texted });
    }

    default:
      return refuse(404, 'Not available in the demo.');
  }
}

// ---------- entry point ----------

/** Same signature as fetch(); handed to the Supabase client in demo mode. */
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : null;
  const url = new URL(request ? request.url : String(input));
  const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers ?? request?.headers);
  const raw = init?.body ?? null;
  let body: unknown = null;
  if (typeof raw === 'string' && raw) {
    try {
      body = JSON.parse(raw);
    } catch {}
  }

  const db = await load();
  // A short pause, so buttons show their spinners like they do over a network.
  await new Promise((resolve) => setTimeout(resolve, 250));

  const [, area, , ...segments] = url.pathname.split('/');
  const path = segments.join('/');
  if (area === 'auth') return auth(db, path, method, body, headers);
  if (area === 'rest') return rest(db, path, method, url.searchParams, body, headers);
  if (area === 'functions') return functions(db, path, body, headers);
  return reply({ message: 'Not available in the demo' }, 404);
}
