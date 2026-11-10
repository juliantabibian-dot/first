// { watcher_id, code }: checks the code the watcher read out and, if it is
// right, marks them confirmed and texts them to say so.
import {
  checkStoredCode,
  CODE_PROBLEMS,
  constantTimeEqual,
  hashCode,
  normalizeCode,
  wrongCodeMessage,
  type StoredCode,
} from '../_shared/codes.ts';
import { must, ownerName, ownWatcher, rows, secret, serveForUser } from '../_shared/db.ts';
import { Refusal } from '../_shared/http.ts';
import { confirmedText } from '../_shared/messages.ts';
import { sendText } from '../_shared/texts.ts';
import { forApp, type Watcher } from '../_shared/watchers.ts';

serveForUser(async ({ db, userId, input }) => {
  const watcher = await ownWatcher(db, userId, input.watcher_id);
  const code = normalizeCode(input.code);
  if (!code) throw new Refusal(400, 'Enter the 6-digit code they got.');
  if (watcher.status === 'verified') throw new Refusal(409, `${watcher.name} is already confirmed.`);
  if (watcher.status === 'opted_out') {
    throw new Refusal(409, `${watcher.name} replied STOP, so they can't be confirmed.`);
  }

  const check = checkStoredCode<StoredCode & { simulated: boolean }>(
    must(
      await db
        .from('watcher_codes')
        .select('code_hash, expires_at, attempts, simulated')
        .eq('watcher_id', watcher.id)
        .maybeSingle(),
    ),
    Date.now(),
  );
  if (!check.ok) {
    throw new Refusal(check.problem === 'locked' ? 429 : 400, CODE_PROBLEMS[check.problem]);
  }
  const stored = check.row;

  // Every try is counted BEFORE the code is compared, and only if the row is
  // exactly as it was just read. Simultaneous guesses therefore can't share a
  // try: one of them wins the update and the rest are turned away.
  const used = stored.attempts + 1;
  const counted = rows(
    await db
      .from('watcher_codes')
      .update({ attempts: used })
      .eq('watcher_id', watcher.id)
      .eq('attempts', stored.attempts)
      .eq('code_hash', stored.code_hash)
      .select('watcher_id'),
  );
  if (!counted.length) throw new Refusal(409, 'Try that again.');

  const expected = await hashCode(secret('SUPABASE_SERVICE_ROLE_KEY'), watcher.id, code);
  if (!constantTimeEqual(expected, stored.code_hash)) {
    throw new Refusal(400, wrongCodeMessage(watcher.name, used));
  }

  // "status = pending" guards against a STOP that arrived in the meantime.
  const confirmed: Watcher[] = rows(
    await db
      .from('watchers')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString(),
        verified_simulated: stored.simulated,
      })
      .eq('id', watcher.id)
      .eq('status', 'pending')
      .select('*'),
  );
  if (!confirmed.length) throw new Refusal(409, `${watcher.name} can't be confirmed right now.`);
  must(await db.from('watcher_codes').delete().eq('watcher_id', watcher.id));

  // The watcher is confirmed whether or not this courtesy text gets through.
  const outcome = await sendText(db, {
    ownerId: userId,
    watcher: confirmed[0],
    body: confirmedText(await ownerName(db, userId)),
  });

  return { watcher: forApp(confirmed[0]), simulated: outcome.status === 'simulated' };
});
