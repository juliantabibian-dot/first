export type WatcherStatus = 'pending' | 'verified' | 'opted_out';

export type Watcher = {
  id: string;
  owner_id: string;
  name: string;
  phone_e164: string;
  status: WatcherStatus;
  verified_at: string | null;
  /** Confirmed while texts were only simulated; see migration 0003. */
  verified_simulated: boolean;
  created_at: string;
};

// Same rules as the checks on the watchers table.
const E164 = /^\+[1-9][0-9]{7,14}$/;
const MAX_NAME = 30;

export function parseNewWatcher(
  input: Record<string, unknown>,
): { name: string; phone: string } | { error: string } {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return { error: 'Enter their name.' };
  if ([...name].length > MAX_NAME) return { error: `Keep the name to ${MAX_NAME} characters.` };
  if (typeof input.phone !== 'string' || !E164.test(input.phone)) {
    return { error: "That doesn't look like a full phone number." };
  }
  return { name, phone: input.phone };
}

/** What the app gets back: the same columns it is allowed to read anyway. */
export function forApp(w: Watcher) {
  return {
    id: w.id,
    name: w.name,
    phone_e164: w.phone_e164,
    status: w.status,
    verified_at: w.verified_at,
    created_at: w.created_at,
  };
}
