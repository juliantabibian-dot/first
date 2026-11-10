import { assert, assertEquals } from 'jsr:@std/assert@1';

import { codeText, confirmedText, MASKED_CODE, removedText, testText } from '../_shared/messages.ts';
import { forApp, parseNewWatcher, type Watcher } from '../_shared/watchers.ts';

Deno.test('code text', () => {
  assertEquals(
    codeText('Julian', '042917'),
    'Lookout: Julian wants to add you as a photo watcher. Your code is 042917. Give it to Julian to confirm. Reply STOP to opt out.',
  );
});

Deno.test('the stored copy of a code text has no digits from the code', () => {
  const stored = codeText('Julian', MASKED_CODE);
  assertEquals(
    stored,
    'Lookout: Julian wants to add you as a photo watcher. Your code is ••••••. Give it to Julian to confirm. Reply STOP to opt out.',
  );
  assert(!/[0-9]/.test(stored));
  // Built from the template, not by search-and-replace, so an owner whose
  // name happens to look like the code can't leak or garble anything.
  assertEquals(
    codeText('123456', MASKED_CODE),
    'Lookout: 123456 wants to add you as a photo watcher. Your code is ••••••. Give it to 123456 to confirm. Reply STOP to opt out.',
  );
});

Deno.test('confirmed and test texts', () => {
  assertEquals(
    confirmedText('Julian'),
    "Lookout: You're confirmed. Julian can now pick photos for you to watch.",
  );
  assertEquals(
    testText('Julian'),
    "Lookout test from Julian: alerts to this number are working. You don't need to reply.",
  );
});

Deno.test('removal text mentions photos only when there are some', () => {
  assertEquals(
    removedText('Julian', 0),
    "Lookout alert: Julian removed you as a watcher. You won't get alerts from them anymore.",
  );
  assertEquals(
    removedText('Julian', 1),
    "Lookout alert: Julian removed you as a watcher on 1 photo. You won't get alerts from them anymore.",
  );
  assertEquals(
    removedText('Julian', 3),
    "Lookout alert: Julian removed you as a watcher on 3 photos. You won't get alerts from them anymore.",
  );
});

Deno.test('a new watcher needs a name of 1 to 30 characters and an E.164 number', () => {
  assertEquals(parseNewWatcher({ name: '  Mom ', phone: '+15551234567' }), {
    name: 'Mom',
    phone: '+15551234567',
  });
  assertEquals(parseNewWatcher({ name: 'x'.repeat(30), phone: '+447911123456' }), {
    name: 'x'.repeat(30),
    phone: '+447911123456',
  });
  // 30 emoji are 30 characters to the database, even though they are 60 UTF-16 units.
  assert('name' in parseNewWatcher({ name: '😀'.repeat(30), phone: '+15551234567' }));

  const error = (input: Record<string, unknown>) => {
    const parsed = parseNewWatcher(input);
    return 'error' in parsed ? parsed.error : null;
  };
  assertEquals(error({ name: '   ', phone: '+15551234567' }), 'Enter their name.');
  assertEquals(error({ phone: '+15551234567' }), 'Enter their name.');
  assertEquals(error({ name: 42, phone: '+15551234567' }), 'Enter their name.');
  assertEquals(error({ name: 'x'.repeat(31), phone: '+15551234567' }), 'Keep the name to 30 characters.');
  for (const phone of ['5551234567', '+0551234567', '+1555', '+1555123456789012', '+1 555 123 4567', '', null, 15551234567]) {
    assertEquals(error({ name: 'Mom', phone }), "That doesn't look like a full phone number.");
  }
});

Deno.test('the app is never sent internal columns', () => {
  const watcher: Watcher = {
    id: 'w1',
    owner_id: 'o1',
    name: 'Mom',
    phone_e164: '+15551234567',
    status: 'pending',
    verified_at: null,
    verified_simulated: false,
    created_at: '2026-01-01T00:00:00Z',
  };
  assertEquals(Object.keys(forApp(watcher)).sort(), [
    'created_at',
    'id',
    'name',
    'phone_e164',
    'status',
    'verified_at',
    'verified_simulated',
  ]);
});
