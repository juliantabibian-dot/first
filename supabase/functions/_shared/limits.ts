// Rate limits. They exist so these functions can't be used to pester people:
// a code text goes to someone who has not agreed to anything yet.

export const MAX_WATCHERS_PER_OWNER = 20;

export type SendKind = 'code' | 'test';

export type SendLimits = {
  /** Minimum gap between two texts of this kind to the same number. */
  cooldownMs: number;
  /** Most texts of this kind to the same number in any hour. */
  perPhonePerHour: number;
  /** Most texts of this kind from one owner, to anyone, in any 24 hours. */
  perOwnerPerDay: number;
};

export const SEND_LIMITS: Record<SendKind, SendLimits> = {
  code: { cooldownMs: 60_000, perPhonePerHour: 5, perOwnerPerDay: 30 },
  test: { cooldownMs: 60_000, perPhonePerHour: 5, perOwnerPerDay: 30 },
};

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** An earlier text of the same kind from the same owner. */
export type Attempt = { phone_e164: string; created_at: string };

export type SendDecision = { ok: true } | { ok: false; reason: 'cooldown' | 'phone' | 'owner' };

/**
 * `others` is every attempt of this kind by this owner in the last 24 hours,
 * not counting the one being decided.
 */
export function decideSend(
  limits: SendLimits,
  others: Attempt[],
  phone: string,
  now: number,
): SendDecision {
  const age = (a: Attempt) => now - new Date(a.created_at).getTime();
  const today = others.filter((a) => age(a) < DAY_MS);
  const toPhone = today.filter((a) => a.phone_e164 === phone);

  if (toPhone.some((a) => age(a) < limits.cooldownMs)) return { ok: false, reason: 'cooldown' };
  if (toPhone.filter((a) => age(a) < HOUR_MS).length >= limits.perPhonePerHour) {
    return { ok: false, reason: 'phone' };
  }
  if (today.length >= limits.perOwnerPerDay) return { ok: false, reason: 'owner' };
  return { ok: true };
}

const WHAT: Record<SendKind, string> = { code: 'codes', test: 'test texts' };

export function limitMessage(kind: SendKind, reason: 'cooldown' | 'phone' | 'owner'): string {
  if (reason === 'cooldown') return 'Wait a minute before texting this number again.';
  if (reason === 'phone') {
    return `That's a lot of ${WHAT[kind]} for one number. Try again in an hour.`;
  }
  return `You've sent a lot of ${WHAT[kind]} today. Try again tomorrow.`;
}
