import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { errorResponse, isUuid, json, preflight, readJson, Refusal } from './http.ts';
import { DAY_MS, decideSend, limitMessage, SEND_LIMITS, type Attempt, type SendKind } from './limits.ts';
import type { Watcher } from './watchers.ts';

export type Db = SupabaseClient;

export function secret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/** Service-role client: bypasses row-level security, so every query must filter by owner itself. */
export function adminClient(): Db {
  return createClient(secret('SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Unwraps a query result, turning a database error into a plain 500. */
export function must<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

/** Like must(), for queries that always return something (a list, or `.single()`). */
export function rows<T>(result: { data: T; error: unknown }): NonNullable<T> {
  const data = must(result);
  if (data == null) throw new Error('The database returned nothing');
  return data;
}

async function requireUser(req: Request, db: Db): Promise<string> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  // Passing the token makes the auth server check it; nothing is trusted from the request itself.
  const { data, error } = token ? await db.auth.getUser(token) : { data: null, error: true };
  if (error || !data?.user) throw new Refusal(401, 'Sign in again to continue.');
  return data.user.id;
}

type Handler = (ctx: { db: Db; userId: string; input: Record<string, unknown> }) => Promise<unknown>;

/** Shared shell for the functions the app calls: CORS, sign-in check, JSON in and out. */
export function serveForUser(handle: Handler): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return preflight();
    try {
      if (req.method !== 'POST') throw new Refusal(405, 'Use POST.');
      const db = adminClient();
      const userId = await requireUser(req, db);
      return json(await handle({ db, userId, input: await readJson(req) }));
    } catch (error) {
      return errorResponse(error);
    }
  });
}

export async function ownerName(db: Db, userId: string): Promise<string> {
  const profile = must(await db.from('profiles').select('name').eq('id', userId).maybeSingle());
  if (!profile) throw new Refusal(403, 'Finish setting up your account first.');
  return profile.name;
}

/** Loads a watcher only if it belongs to the caller. */
export async function ownWatcher(db: Db, userId: string, watcherId: unknown): Promise<Watcher> {
  const watcher = isUuid(watcherId)
    ? must(
        await db.from('watchers').select('*').eq('id', watcherId).eq('owner_id', userId).maybeSingle(),
      )
    : null;
  if (!watcher) throw new Refusal(404, "That watcher isn't on your list anymore.");
  return watcher;
}

/**
 * Claims the right to send one text of this kind, or refuses with a 429.
 *
 * The attempt is written first and the earlier ones counted afterwards. Doing
 * it in that order means a burst of simultaneous requests all see each other
 * and are refused together, instead of all slipping past a count that was
 * taken before any of them was recorded.
 */
export async function reserveSend(
  db: Db,
  ownerId: string,
  phone: string,
  kind: SendKind,
): Promise<void> {
  const dayAgo = new Date(Date.now() - DAY_MS).toISOString();
  must(await db.from('send_attempts').delete().eq('owner_id', ownerId).lt('created_at', dayAgo));

  const mine = rows(
    await db
      .from('send_attempts')
      .insert({ owner_id: ownerId, phone_e164: phone, kind })
      .select('id')
      .single(),
  );
  const others: Attempt[] = rows(
    await db
      .from('send_attempts')
      .select('phone_e164, created_at')
      .eq('owner_id', ownerId)
      .eq('kind', kind)
      .neq('id', mine.id)
      .gt('created_at', dayAgo),
  );

  const decision = decideSend(SEND_LIMITS[kind], others, phone, Date.now());
  if (decision.ok) return;
  // A refused attempt sent nothing, so it shouldn't count against the next one.
  must(await db.from('send_attempts').delete().eq('id', mine.id));
  throw new Refusal(429, limitMessage(kind, decision.reason));
}
