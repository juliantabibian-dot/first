// The 6-digit code that proves a watcher's number is real and that they agreed
// to be added. Pure logic only; nothing here talks to the database.

export const CODE_LIFETIME_MS = 10 * 60 * 1000;
export const MAX_WRONG_TRIES = 5;

const CODE_SPACE = 1_000_000;
// Largest multiple of CODE_SPACE that fits in 32 bits. Values above it are
// thrown away so that every code is exactly equally likely.
const UNBIASED_LIMIT = Math.floor(0x1_0000_0000 / CODE_SPACE) * CODE_SPACE;

export function generateCode(): string {
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= UNBIASED_LIMIT);
  return String(buf[0] % CODE_SPACE).padStart(6, '0');
}

/**
 * Only this hash is stored. It is an HMAC keyed with a server-side secret, so
 * even someone who could read the database could not work the code back out
 * by trying all million possibilities. The watcher id is mixed in so a hash
 * is useless for any other watcher.
 */
export async function hashCode(secret: string, watcherId: string, code: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`watcher-code:${watcherId}:${code}`));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares without stopping at the first difference, so timing reveals nothing. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Accepts "123456" or "123 456"; anything else is not a code. */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s-]/g, '');
  return /^[0-9]{6}$/.test(digits) ? digits : null;
}

export type StoredCode = { code_hash: string; expires_at: string; attempts: number };
export type CodeProblem = 'missing' | 'expired' | 'locked';

/** Whether a stored code can still be tried at all, before looking at the guess. */
export function checkStoredCode<T extends StoredCode>(
  row: T | null,
  now: number,
): { ok: true; row: T } | { ok: false; problem: CodeProblem } {
  if (!row) return { ok: false, problem: 'missing' };
  if (new Date(row.expires_at).getTime() <= now) return { ok: false, problem: 'expired' };
  if (row.attempts >= MAX_WRONG_TRIES) return { ok: false, problem: 'locked' };
  return { ok: true, row };
}

export const CODE_PROBLEMS: Record<CodeProblem, string> = {
  missing: "There's no code waiting for this number. Text them a new one.",
  expired: 'That code has expired. Text them a new one.',
  locked: 'Too many wrong tries. Text them a new code.',
};

/** `triesUsed` includes the wrong try that was just made. */
export function wrongCodeMessage(watcherName: string, triesUsed: number): string {
  const left = MAX_WRONG_TRIES - triesUsed;
  if (left <= 0) return "That code doesn't match, and that was the last try. Text them a new code.";
  const tries = left === 1 ? '1 try left' : `${left} tries left`;
  return `That code doesn't match. Check with ${watcherName}. (${tries})`;
}
