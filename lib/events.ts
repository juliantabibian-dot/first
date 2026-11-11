import { safeStorage } from './safeStorage';
import { callFunction, type Result } from './watchers';

export type PhotoEvent = 'share' | 'download' | 'screenshot' | 'delete';

type Queued = { photo_id: string; type: PhotoEvent; at: string };

const KEY = 'lookout-unreported-events';

async function readQueue(): Promise<Queued[]> {
  try {
    const saved = await safeStorage.getItem(KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Tells the server something happened to a photo, so its watchers are texted.
 *
 * A share, download or screenshot has already happened by the time this runs,
 * so if the phone is offline the report is kept and sent later by
 * flushUnreportedEvents(). Going offline must not be a way to skip the alert.
 */
export async function reportEvent(
  photoId: string,
  type: PhotoEvent,
): Promise<Result<{ texted: number }>> {
  const result = await callFunction<{ texted: number }>('report-event', {
    photo_id: photoId,
    type,
  });
  if (!result.ok && result.network && type !== 'delete') {
    const queue = await readQueue();
    queue.push({ photo_id: photoId, type, at: new Date().toISOString() });
    await safeStorage.setItem(KEY, JSON.stringify(queue.slice(-200)));
  }
  return result;
}

let flushing = false;

/** Sends reports that couldn't be sent earlier. Safe to call often. */
export async function flushUnreportedEvents(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const queue = await readQueue();
    if (!queue.length) return;
    const left: Queued[] = [];
    for (const [index, item] of queue.entries()) {
      const result = await callFunction('report-event', item);
      // Still offline: keep this one and everything after it. A refusal from
      // the server (say the photo is gone) is final, so that report is dropped.
      if (!result.ok && result.network) {
        left.push(...queue.slice(index));
        break;
      }
    }
    await safeStorage.setItem(KEY, JSON.stringify(left));
  } finally {
    flushing = false;
  }
}
