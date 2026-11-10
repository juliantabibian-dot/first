// { watcher_id }: texts a confirmed watcher to show that alerts reach them.
import { must, ownerName, ownWatcher, rows, reserveSend, serveForUser } from '../_shared/db.ts';
import { Refusal } from '../_shared/http.ts';
import { testText } from '../_shared/messages.ts';
import { sendText } from '../_shared/texts.ts';

serveForUser(async ({ db, userId, input }) => {
  const watcher = await ownWatcher(db, userId, input.watcher_id);
  if (watcher.status === 'opted_out') {
    throw new Refusal(409, `${watcher.name} replied STOP, so Lookout can't text them.`);
  }
  if (watcher.status !== 'verified') {
    throw new Refusal(409, `Confirm ${watcher.name}'s number before sending a test.`);
  }
  const owner = await ownerName(db, userId);

  await reserveSend(db, userId, watcher.phone_e164, 'test');

  const event = rows(
    await db
      .from('events')
      .insert({
        owner_id: userId,
        actor_id: userId,
        type: 'test',
        meta: { watcher_id: watcher.id, watcher_name: watcher.name },
      })
      .select('id')
      .single(),
  );
  const outcome = await sendText(db, {
    ownerId: userId,
    watcher,
    body: testText(owner),
    eventId: event.id,
  });
  if (outcome.status === 'skipped') throw new Refusal(409, outcome.message);
  if (outcome.status === 'failed') throw new Refusal(502, outcome.message);

  return { simulated: outcome.status === 'simulated' };
});
