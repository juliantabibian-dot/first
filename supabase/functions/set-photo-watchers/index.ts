// { photo_ids, watcher_ids }: makes exactly these watchers watch each of these
// photos. Anyone newly added is texted, and so is anyone taken off, so a
// watcher can't be dropped quietly before a photo is shared.
import { idList, MAX_PHOTOS_PER_CHANGE, planAssignments, type Assignment } from '../_shared/assign.ts';
import { must, ownerName, rows, serveForUser } from '../_shared/db.ts';
import { Refusal } from '../_shared/http.ts';
import { MAX_WATCHERS_PER_OWNER } from '../_shared/limits.ts';
import { assignedText, unassignedText } from '../_shared/messages.ts';
import { sendText } from '../_shared/texts.ts';
import type { Watcher } from '../_shared/watchers.ts';

serveForUser(async ({ db, userId, input }) => {
  const photoIds = idList(input.photo_ids, 1, MAX_PHOTOS_PER_CHANGE);
  const wanted = idList(input.watcher_ids, 0, MAX_WATCHERS_PER_OWNER);
  if (!photoIds || !wanted) throw new Refusal(400, "That request wasn't understood.");
  const owner = await ownerName(db, userId);

  const photos: { id: string }[] = rows(
    await db.from('photos').select('id').eq('owner_id', userId).is('deleted_at', null).in('id', photoIds),
  );
  if (photos.length !== photoIds.length) {
    throw new Refusal(404, "One of those photos isn't in your library anymore.");
  }

  const current: Assignment[] = rows(
    await db.from('photo_watchers').select('photo_id, watcher_id').in('photo_id', photoIds),
  );
  const change = planAssignments(photoIds, current, wanted);

  // Everyone involved, looked up through the owner so nobody else's watcher can be used.
  const involved = [...new Set([...wanted, ...change.removed.keys()])];
  const watchers: Watcher[] = involved.length
    ? rows(await db.from('watchers').select('*').eq('owner_id', userId).in('id', involved))
    : [];
  const byId = new Map(watchers.map((w) => [w.id, w]));
  for (const id of wanted) {
    const watcher = byId.get(id);
    if (!watcher) throw new Refusal(404, "One of those watchers isn't on your list anymore.");
    // Someone already on these photos may stay; only new additions must be confirmed.
    if (change.added.has(id) && watcher.status !== 'verified') {
      throw new Refusal(409, `${watcher.name} hasn't confirmed their number, so they can't watch photos yet.`);
    }
  }

  if (change.add.length) {
    must(await db.from('photo_watchers').upsert(change.add, { onConflict: 'photo_id,watcher_id', ignoreDuplicates: true }));
  }
  for (const watcherId of change.removed.keys()) {
    const theirs = change.remove.filter((a) => a.watcher_id === watcherId).map((a) => a.photo_id);
    must(await db.from('photo_watchers').delete().eq('watcher_id', watcherId).in('photo_id', theirs));
  }

  const tell = async (watcherId: string, count: number, type: 'watcher_added' | 'watcher_removed') => {
    const watcher = byId.get(watcherId);
    // Only confirmed watchers are ever texted (a removed one may have opted out since).
    if (!watcher || watcher.status !== 'verified') return false;
    const event = rows(
      await db
        .from('events')
        .insert({
          owner_id: userId,
          actor_id: userId,
          photo_id: photoIds.length === 1 ? photoIds[0] : null,
          type,
          meta: { watcher_id: watcher.id, watcher_name: watcher.name, photos: count },
        })
        .select('id')
        .single(),
    );
    const outcome = await sendText(db, {
      ownerId: userId,
      watcher,
      body: type === 'watcher_added' ? assignedText(owner, count) : unassignedText(owner, count),
      eventId: event.id,
    });
    return outcome.status === 'sent' || outcome.status === 'simulated';
  };

  let added = 0;
  let removed = 0;
  for (const [watcherId, count] of change.added) if (await tell(watcherId, count, 'watcher_added')) added += 1;
  for (const [watcherId, count] of change.removed) if (await tell(watcherId, count, 'watcher_removed')) removed += 1;

  // How many people were texted about being added / removed.
  return { added, removed };
});
