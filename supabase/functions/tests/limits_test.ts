import { assertEquals } from 'jsr:@std/assert@1';

import { decideSend, limitMessage, SEND_LIMITS, type Attempt } from '../_shared/limits.ts';

const NOW = Date.parse('2026-01-01T12:00:00Z');
const MOM = '+15550000001';
const DAD = '+15550000002';
const limits = SEND_LIMITS.code;

const ago = (phone: string, seconds: number): Attempt => ({
  phone_e164: phone,
  created_at: new Date(NOW - seconds * 1000).toISOString(),
});
const many = (phone: string, count: number, startSeconds: number, stepSeconds: number) =>
  Array.from({ length: count }, (_, i) => ago(phone, startSeconds + i * stepSeconds));

Deno.test('the limits are the documented ones', () => {
  assertEquals(SEND_LIMITS.code, { cooldownMs: 60_000, perPhonePerHour: 5, perOwnerPerDay: 30 });
  assertEquals(SEND_LIMITS.test, { cooldownMs: 60_000, perPhonePerHour: 5, perOwnerPerDay: 30 });
});

Deno.test('the first text is allowed', () => {
  assertEquals(decideSend(limits, [], MOM, NOW), { ok: true });
});

Deno.test('a second text to the same number has to wait 60 seconds', () => {
  assertEquals(decideSend(limits, [ago(MOM, 59)], MOM, NOW), { ok: false, reason: 'cooldown' });
  assertEquals(decideSend(limits, [ago(MOM, 60)], MOM, NOW), { ok: true });
  assertEquals(decideSend(limits, [ago(MOM, 0)], MOM, NOW), { ok: false, reason: 'cooldown' });
});

Deno.test('a text to one number does not hold up another number', () => {
  assertEquals(decideSend(limits, [ago(DAD, 1)], MOM, NOW), { ok: true });
});

Deno.test('a row stamped slightly in the future (clock skew) still counts', () => {
  assertEquals(decideSend(limits, [ago(MOM, -2)], MOM, NOW), { ok: false, reason: 'cooldown' });
});

Deno.test('at most 5 an hour to one number', () => {
  assertEquals(decideSend(limits, many(MOM, 4, 120, 600), MOM, NOW), { ok: true });
  assertEquals(decideSend(limits, many(MOM, 5, 120, 600), MOM, NOW), { ok: false, reason: 'phone' });
  // Five to someone else are irrelevant.
  assertEquals(decideSend(limits, many(DAD, 5, 120, 600), MOM, NOW), { ok: true });
  // Five, but only four inside the last hour.
  assertEquals(decideSend(limits, [...many(MOM, 4, 120, 600), ago(MOM, 3601)], MOM, NOW), { ok: true });
});

Deno.test('at most 30 a day from one owner, whoever they go to', () => {
  const spread = (count: number) =>
    Array.from({ length: count }, (_, i) => ago(`+1555100${String(i).padStart(4, '0')}`, 3700 + i * 60));
  assertEquals(decideSend(limits, spread(29), MOM, NOW), { ok: true });
  assertEquals(decideSend(limits, spread(30), MOM, NOW), { ok: false, reason: 'owner' });
  // Anything older than 24 hours no longer counts.
  const old = Array.from({ length: 40 }, (_, i) => ago(DAD, 86_400 + i));
  assertEquals(decideSend(limits, old, MOM, NOW), { ok: true });
});

Deno.test('the cooldown is reported before the bigger limits', () => {
  const lots = [ago(MOM, 5), ...many(MOM, 6, 120, 60)];
  assertEquals(decideSend(limits, lots, MOM, NOW), { ok: false, reason: 'cooldown' });
});

Deno.test('limit messages are short sentences', () => {
  assertEquals(limitMessage('code', 'cooldown'), 'Wait a minute before texting this number again.');
  assertEquals(limitMessage('code', 'phone'), "That's a lot of codes for one number. Try again in an hour.");
  assertEquals(limitMessage('test', 'phone'), "That's a lot of test texts for one number. Try again in an hour.");
  assertEquals(limitMessage('code', 'owner'), "You've sent a lot of codes today. Try again tomorrow.");
});
