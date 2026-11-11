// Working out who gains and who loses photos when a watcher list is saved.
// Pure logic; nothing here talks to the database.

export const MAX_PHOTOS_PER_CHANGE = 50;

export type Assignment = { photo_id: string; watcher_id: string };

export type AssignmentChange = {
  add: Assignment[];
  remove: Assignment[];
  /** Watcher id -> how many photos they were just put on / taken off. */
  added: Map<string, number>;
  removed: Map<string, number>;
};

/** After the change, every photo in `photoIds` is watched by exactly `wanted`. */
export function planAssignments(
  photoIds: string[],
  current: Assignment[],
  wanted: string[],
): AssignmentChange {
  const change: AssignmentChange = { add: [], remove: [], added: new Map(), removed: new Map() };
  const bump = (map: Map<string, number>, id: string) => map.set(id, (map.get(id) ?? 0) + 1);
  for (const photoId of photoIds) {
    const before = new Set(current.filter((a) => a.photo_id === photoId).map((a) => a.watcher_id));
    for (const watcherId of wanted) {
      if (before.has(watcherId)) continue;
      change.add.push({ photo_id: photoId, watcher_id: watcherId });
      bump(change.added, watcherId);
    }
    for (const watcherId of before) {
      if (wanted.includes(watcherId)) continue;
      change.remove.push({ photo_id: photoId, watcher_id: watcherId });
      bump(change.removed, watcherId);
    }
  }
  return change;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A list of distinct ids, or null if the input isn't one. */
export function idList(input: unknown, min: number, max: number): string[] | null {
  if (!Array.isArray(input)) return null;
  const ids = [...new Set(input)];
  if (ids.length < min || ids.length > max) return null;
  return ids.every((id) => typeof id === 'string' && UUID.test(id)) ? (ids as string[]) : null;
}
