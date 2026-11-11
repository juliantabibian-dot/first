// { photo_id, type }: something happened to a photo (shared, downloaded,
// screenshotted, deleted). Logs it and texts that photo's confirmed watchers.
// For "delete" this function also does the deleting, so a photo can't be
// removed without its watchers hearing about it.
import { must, ownerName, rows, serveForUser } from '../_shared/db.ts';
import { isUuid, Refusal } from '../_shared/http.ts';
import { BLOCKED_PHOTO, eventText, isPhotoEvent, leavesTheApp } from '../_shared/messages.ts';
import { sendText } from '../_shared/texts.ts';
import type { Watcher } from '../_shared/watchers.ts';

serveForUser(async ({ db, userId, input }) => {
  const type = input.type;
  if (!isPhotoEvent(type) || !isUuid(input.photo_id)) {
    throw new Refusal(400, "That request wasn't understood.");
  }

  const photo = must(
    await db
      .from('photos')
      .select('id, storage_path, download_policy, deleted_at')
      .eq('id', input.photo_id)
      .eq('owner_id', userId)
      .maybeSingle(),
  );
  if (!photo || photo.deleted_at) {
    throw new Refusal(404, "That photo isn't in your library anymore.");
  }
  if (leavesTheApp(type) && photo.download_policy === 'blocked') {
    throw new Refusal(403, BLOCKED_PHOTO);
  }
  const owner = await ownerName(db, userId);

  // Who to tell, read before a delete clears the assignments.
  const assigned: { watcher_id: string }[] = rows(
    await db.from('photo_watchers').select('watcher_id').eq('photo_id', photo.id),
  );
  const watchers: Watcher[] = assigned.length
    ? rows(
        await db
          .from('watchers')
          .select('*')
          .eq('owner_id', userId)
          .eq('status', 'verified')
          .in('id', assigned.map((a) => a.watcher_id)),
      )
    : [];

  if (type === 'delete') {
    must(await db.from('photos').update({ deleted_at: new Date().toISOString() }).eq('id', photo.id));
    must(await db.from('photo_watchers').delete().eq('photo_id', photo.id));
    // The row stays as history; the image itself is removed for good.
    const removed = await db.storage.from('photos').remove([photo.storage_path]);
    if (removed.error) console.error('Could not remove a deleted photo from storage', removed.error.message);
  }

  // When the phone reported late (it was offline), `at` is when it really happened.
  const at = typeof input.at === 'string' && !Number.isNaN(Date.parse(input.at)) ? input.at : null;
  const event = rows(
    await db
      .from('events')
      .insert({
        owner_id: userId,
        actor_id: userId,
        photo_id: photo.id,
        type,
        meta: { watchers: watchers.length, ...(at ? { happened_at: at } : {}) },
      })
      .select('id')
      .single(),
  );

  let texted = 0;
  for (const watcher of watchers) {
    const outcome = await sendText(db, {
      ownerId: userId,
      watcher,
      body: eventText(owner, type),
      eventId: event.id,
    });
    if (outcome.status === 'sent' || outcome.status === 'simulated') texted += 1;
  }

  // How many watchers were texted.
  return { texted };
});
