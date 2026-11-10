// { watcher_id }: takes someone off the caller's watcher list. A confirmed
// watcher is texted first, so nobody can be dropped quietly.
import { must, ownerName, ownWatcher, rows, serveForUser } from '../_shared/db.ts';
import { removedText } from '../_shared/messages.ts';
import { sendText } from '../_shared/texts.ts';

serveForUser(async ({ db, userId, input }) => {
  const watcher = await ownWatcher(db, userId, input.watcher_id);
  let texted = false;

  if (watcher.status === 'verified') {
    const owner = await ownerName(db, userId);
    const watching = await db
      .from('photo_watchers')
      .select('photo_id', { count: 'exact', head: true })
      .eq('watcher_id', watcher.id);
    if (watching.error) throw watching.error;
    const photos = watching.count ?? 0;

    const event = rows(
      await db
        .from('events')
        .insert({
          owner_id: userId,
          actor_id: userId,
          type: 'watcher_removed',
          meta: { watcher_name: watcher.name, photos, removed_from_list: true },
        })
        .select('id')
        .single(),
    );
    // If the text can't be delivered the removal still goes ahead; the failed
    // text stays in the owner's history.
    const outcome = await sendText(db, {
      ownerId: userId,
      watcher,
      body: removedText(owner, photos),
      eventId: event.id,
    });
    texted = outcome.status === 'sent' || outcome.status === 'simulated';
  }

  // Deleting the watcher also deletes their code and photo assignments.
  must(await db.from('watchers').delete().eq('id', watcher.id).eq('owner_id', userId));
  return { removed: true, texted };
});
