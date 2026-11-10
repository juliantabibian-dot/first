import { assert, assertEquals, assertMatch, assertNotEquals } from 'jsr:@std/assert@1';

import {
  checkStoredCode,
  constantTimeEqual,
  generateCode,
  hashCode,
  MAX_WRONG_TRIES,
  normalizeCode,
  wrongCodeMessage,
} from '../_shared/codes.ts';

const WATCHER = '20000000-0000-0000-0000-000000000001';
const OTHER = '20000000-0000-0000-0000-000000000002';

Deno.test('codes are always 6 digits and not stuck on one value', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 2000; i++) {
    const code = generateCode();
    assertMatch(code, /^[0-9]{6}$/);
    seen.add(code);
  }
  assert(seen.size > 1900, `only ${seen.size} different codes out of 2000`);
});

Deno.test('codes use the whole range, including leading zeros', () => {
  let low = 0;
  for (let i = 0; i < 5000; i++) if (generateCode() < '100000') low++;
  // Expect about 10%. A generator that never produced a leading zero would give 0.
  assert(low > 350 && low < 650, `${low} of 5000 started with 0`);
});

Deno.test('the hash depends on the secret, the watcher and the code, and never contains the code', async () => {
  const hash = await hashCode('secret', WATCHER, '123456');
  assertMatch(hash, /^[0-9a-f]{64}$/);
  assertEquals(hash, await hashCode('secret', WATCHER, '123456'));
  assertNotEquals(hash, await hashCode('secret', WATCHER, '123457'));
  assertNotEquals(hash, await hashCode('secret', OTHER, '123456'));
  assertNotEquals(hash, await hashCode('other secret', WATCHER, '123456'));
  assert(!hash.includes('123456'));
});

Deno.test('the hash is a standard HMAC-SHA256', async () => {
  // Worked out separately with Node's crypto module:
  // createHmac('sha256', 'secret').update('watcher-code:<WATCHER>:123456').digest('hex')
  assertEquals(
    await hashCode('secret', WATCHER, '123456'),
    '199b921bbc176591d3f209ffc0a79781b03522655e14246676dae9e507295fa9',
  );
});

Deno.test('a right code matches its hash and a wrong one does not', async () => {
  const stored = await hashCode('secret', WATCHER, '004200');
  assert(constantTimeEqual(await hashCode('secret', WATCHER, '004200'), stored));
  assert(!constantTimeEqual(await hashCode('secret', WATCHER, '004201'), stored));
});

Deno.test('constantTimeEqual', () => {
  assert(constantTimeEqual('', ''));
  assert(constantTimeEqual('abc', 'abc'));
  assert(!constantTimeEqual('abc', 'abd'));
  assert(!constantTimeEqual('abc', 'ab'));
  assert(!constantTimeEqual('abc', 'abcd'));
});

Deno.test('normalizeCode accepts 6 digits, with spaces or a dash, and nothing else', () => {
  assertEquals(normalizeCode('123456'), '123456');
  assertEquals(normalizeCode(' 123 456 '), '123456');
  assertEquals(normalizeCode('123-456'), '123456');
  assertEquals(normalizeCode('012345'), '012345');
  for (const bad of ['12345', '1234567', '12345a', '', '１２３４５６', 123456, null, undefined, {}]) {
    assertEquals(normalizeCode(bad), null);
  }
});

Deno.test('a stored code can be tried only while it is fresh and has tries left', () => {
  const now = Date.parse('2026-01-01T12:00:00Z');
  const row = (minutesLeft: number, attempts: number) => ({
    code_hash: 'x',
    expires_at: new Date(now + minutesLeft * 60_000).toISOString(),
    attempts,
  });
  assertEquals(checkStoredCode(null, now), { ok: false, problem: 'missing' });
  assertEquals(checkStoredCode(row(-1, 0), now), { ok: false, problem: 'expired' });
  assertEquals(checkStoredCode(row(0, 0), now), { ok: false, problem: 'expired' });
  assertEquals(checkStoredCode(row(5, MAX_WRONG_TRIES), now), { ok: false, problem: 'locked' });
  assertEquals(checkStoredCode(row(5, MAX_WRONG_TRIES - 1), now).ok, true);
  assertEquals(checkStoredCode(row(10, 0), now).ok, true);
  // Expired wins over locked: either way they need a new code.
  assertEquals(checkStoredCode(row(-1, MAX_WRONG_TRIES), now), { ok: false, problem: 'expired' });
});

Deno.test('the wrong-code message counts down and ends by asking for a new code', () => {
  assertEquals(wrongCodeMessage('Mom', 1), "That code doesn't match. Check with Mom. (4 tries left)");
  assertEquals(wrongCodeMessage('Mom', 4), "That code doesn't match. Check with Mom. (1 try left)");
  assertEquals(
    wrongCodeMessage('Mom', 5),
    "That code doesn't match, and that was the last try. Text them a new code.",
  );
});
