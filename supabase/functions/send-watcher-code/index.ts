// Texts a 6-digit code to a watcher's number.
//   { name, phone }  adds a new watcher (pending) and texts the first code
//   { watcher_id }   texts a fresh code to a watcher who is still pending
import { CODE_LIFETIME_MS, generateCode, hashCode } from '../_shared/codes.ts';
import { must, ownerName, ownWatcher, reserveSend, rows, secret, serveForUser } from '../_shared/db.ts';
import { Refusal } from '../_shared/http.ts';
import { MAX_WATCHERS_PER_OWNER } from '../_shared/limits.ts';
import { codeText, MASKED_CODE } from '../_shared/messages.ts';
import { sendText } from '../_shared/texts.ts';
import { twilioMode } from '../_shared/twilio.ts';
import { forApp, parseNewWatcher, type Watcher } from '../_shared/watchers.ts';

const UNIQUE_VIOLATION = '23505';
const ALREADY_LISTED = 'That number is already on your list.';
const LIST_FULL = `You can have up to ${MAX_WATCHERS_PER_OWNER} watchers. Remove one to add another.`;

serveForUser(async ({ db, userId, input }) => {
  const owner = await ownerName(db, userId);
  const isNew = input.watcher_id === undefined;
  let watcher: Watcher;

  if (isNew) {
    const parsed = parseNewWatcher(input);
    if ('error' in parsed) throw new Refusal(400, parsed.error);

    const mine = () =>
      db.from('watchers').select('id', { count: 'exact', head: true }).eq('owner_id', userId);
    const listed = await mine().eq('phone_e164', parsed.phone);
    if (listed.error) throw listed.error;
    if (listed.count) throw new Refusal(409, ALREADY_LISTED);
    const before = await mine();
    if (before.error) throw before.error;
    if ((before.count ?? 0) >= MAX_WATCHERS_PER_OWNER) throw new Refusal(409, LIST_FULL);

    await reserveSend(db, userId, parsed.phone, 'code');

    const created = await db
      .from('watchers')
      .insert({ owner_id: userId, name: parsed.name, phone_e164: parsed.phone })
      .select('*')
      .single();
    if (created.error?.code === UNIQUE_VIOLATION) throw new Refusal(409, ALREADY_LISTED);
    watcher = rows(created);

    // Counted again now that the row exists, so simultaneous requests can't
    // squeeze past the cap together.
    const after = await mine();
    if (after.error || (after.count ?? 0) > MAX_WATCHERS_PER_OWNER) {
      must(await db.from('watchers').delete().eq('id', watcher.id));
      if (after.error) throw after.error;
      throw new Refusal(409, LIST_FULL);
    }
  } else {
    watcher = await ownWatcher(db, userId, input.watcher_id);
    if (watcher.status === 'verified') {
      throw new Refusal(409, `${watcher.name} is already confirmed.`);
    }
    if (watcher.status === 'opted_out') {
      throw new Refusal(409, `${watcher.name} replied STOP, so Lookout can't text them.`);
    }
    await reserveSend(db, userId, watcher.phone_e164, 'code');
  }

  const code = generateCode();
  const now = Date.now();
  // Replaces any earlier code, so only the newest one works.
  must(
    await db.from('watcher_codes').upsert({
      watcher_id: watcher.id,
      code_hash: await hashCode(secret('SUPABASE_SERVICE_ROLE_KEY'), watcher.id, code),
      expires_at: new Date(now + CODE_LIFETIME_MS).toISOString(),
      attempts: 0,
      sent_at: new Date(now).toISOString(),
      simulated: twilioMode((name) => Deno.env.get(name)).kind === 'simulated',
    }),
  );

  const outcome = await sendText(db, {
    ownerId: userId,
    watcher,
    body: codeText(owner, code),
    storedBody: codeText(owner, MASKED_CODE),
  });

  if (outcome.status === 'failed' || outcome.status === 'skipped') {
    // Nobody got the code, so it must not stay usable. A brand-new watcher is
    // taken off the list again: adding either works or changes nothing.
    if (isNew) must(await db.from('watchers').delete().eq('id', watcher.id));
    else must(await db.from('watcher_codes').delete().eq('watcher_id', watcher.id));
    throw new Refusal(502, outcome.message);
  }

  return { watcher: forApp(watcher), simulated: outcome.status === 'simulated' };
});
