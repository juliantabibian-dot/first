// {}: deletes the caller's account and everything in it: photos (files and
// records), watchers, and history. Confirmed watchers are texted first, for
// the same reason a single photo can't be deleted quietly.
import { ownerName, rows, serveForUser } from '../_shared/db.ts';
import { accountDeletedText } from '../_shared/messages.ts';
import { sendText } from '../_shared/texts.ts';
import type { Watcher } from '../_shared/watchers.ts';

serveForUser(async ({ db, userId }) => {
  // Someone who signed in but never entered a name has no profile and nothing to tell.
  const owner = await ownerName(db, userId).catch(() => null);

  if (owner) {
    const watchers: Watcher[] = rows(
      await db.from('watchers').select('*').eq('owner_id', userId).eq('status', 'verified'),
    );
    for (const watcher of watchers) {
      // The text log is deleted along with the account, so the outcome isn't kept.
      await sendText(db, { ownerId: userId, watcher, body: accountDeletedText(owner) });
    }
  }

  // Photo files live under "<user id>/". Removed in pages until none are left.
  const bucket = db.storage.from('photos');
  for (let page = 0; page < 100; page++) {
    const listed = await bucket.list(userId, { limit: 100 });
    if (listed.error) throw listed.error;
    if (!listed.data.length) break;
    const removed = await bucket.remove(listed.data.map((file) => `${userId}/${file.name}`));
    if (removed.error) throw removed.error;
  }

  // Deleting the sign-in record removes the profile, and with it every photo
  // record, watcher, event and text (they all cascade from the profile).
  const deleted = await db.auth.admin.deleteUser(userId);
  if (deleted.error) throw deleted.error;

  return { deleted: true };
});
