import { assertEquals } from 'jsr:@std/assert@1';

import { idList, planAssignments } from '../_shared/assign.ts';
import { assignedText, unassignedText } from '../_shared/messages.ts';

const P1 = '10000000-0000-4000-a000-000000000001';
const P2 = '10000000-0000-4000-a000-000000000002';
const MOM = '20000000-0000-4000-a000-000000000001';
const DAD = '20000000-0000-4000-a000-000000000002';

Deno.test('new photos: everyone chosen is added once per photo', () => {
  const change = planAssignments([P1, P2], [], [MOM, DAD]);
  assertEquals(change.add.length, 4);
  assertEquals(change.remove, []);
  assertEquals([...change.added], [[MOM, 2], [DAD, 2]]);
});

Deno.test('unticking someone removes them; people who stay are not touched', () => {
  const current = [{ photo_id: P1, watcher_id: MOM }, { photo_id: P1, watcher_id: DAD }];
  const change = planAssignments([P1], current, [MOM]);
  assertEquals(change.add, []);
  assertEquals(change.remove, [{ photo_id: P1, watcher_id: DAD }]);
  assertEquals([...change.added], []);
  assertEquals([...change.removed], [[DAD, 1]]);
});

Deno.test('a mixed batch counts per watcher', () => {
  const current = [{ photo_id: P1, watcher_id: MOM }, { photo_id: P2, watcher_id: DAD }];
  const change = planAssignments([P1, P2], current, [MOM]);
  assertEquals([...change.added], [[MOM, 1]]);
  assertEquals([...change.removed], [[DAD, 1]]);
});

Deno.test('saving the same list again changes nothing', () => {
  const current = [{ photo_id: P1, watcher_id: MOM }];
  const change = planAssignments([P1], current, [MOM]);
  assertEquals(change.add.length + change.remove.length, 0);
});

Deno.test('id lists must be distinct uuids within the size limits', () => {
  assertEquals(idList([P1, P1], 1, 5), [P1]);
  assertEquals(idList([], 0, 5), []);
  assertEquals(idList([], 1, 5), null);
  assertEquals(idList([P1, P2], 1, 1), null);
  assertEquals(idList(['nope'], 1, 5), null);
  assertEquals(idList('x', 0, 5), null);
});

Deno.test('assignment texts match the agreed wording', () => {
  assertEquals(
    assignedText('Julian', 1),
    "Lookout: Julian made you a watcher on a photo. You'll get a text if it's shared, downloaded or screenshotted.",
  );
  assertEquals(
    assignedText('Julian', 3),
    "Lookout: Julian made you a watcher on 3 photos. You'll get a text if any of them is shared, downloaded or screenshotted.",
  );
  assertEquals(
    unassignedText('Julian', 1),
    "Lookout alert: Julian removed you as a watcher on a photo. You won't be told about it anymore.",
  );
  assertEquals(
    unassignedText('Julian', 2),
    "Lookout alert: Julian removed you as a watcher on 2 photos. You won't be told about them anymore.",
  );
});

Deno.test('alert texts for things that happen to a photo', async () => {
  const { BLOCKED_PHOTO, eventText, isPhotoEvent, leavesTheApp } = await import('../_shared/messages.ts');
  assertEquals(
    eventText('Julian', 'download'),
    "Lookout alert: Julian downloaded a photo you're watching. It's now saved outside the app.",
  );
  assertEquals(
    eventText('Julian', 'share'),
    "Lookout alert: Julian shared a photo you're watching. It may now be outside the app.",
  );
  assertEquals(
    eventText('Julian', 'screenshot'),
    "Lookout alert: Julian took a screenshot while viewing a photo you're watching.",
  );
  assertEquals(eventText('Julian', 'delete'), 'Lookout alert: Julian deleted a photo you were watching.');
  assertEquals(isPhotoEvent('download'), true);
  assertEquals(isPhotoEvent('watcher_added'), false);
  assertEquals(isPhotoEvent(null), false);
  // A blocked photo may be neither saved nor shared; it can still be screenshotted or deleted.
  assertEquals([leavesTheApp('share'), leavesTheApp('download')], [true, true]);
  assertEquals([leavesTheApp('screenshot'), leavesTheApp('delete')], [false, false]);
  assertEquals(BLOCKED_PHOTO.includes("can't be saved or shared"), true);
});

Deno.test('account deletion text', async () => {
  const { accountDeletedText } = await import('../_shared/messages.ts');
  assertEquals(
    accountDeletedText('Julian'),
    "Lookout alert: Julian deleted their Lookout account, including the photos you were watching. You won't get alerts from them anymore.",
  );
});
