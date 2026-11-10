import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1';

import { constantTimeEqual } from '../_shared/codes.ts';
import {
  replyKind,
  statusAfterStart,
  twilioFailureMessage,
  twilioMode,
  twilioSignature,
} from '../_shared/twilio.ts';

// The worked example from Twilio's "Validating Requests" documentation.
const DOCS_TOKEN = '12345';
const DOCS_URL = 'https://mycompany.com/myapp.php?foo=1&bar=2';
const docsParams = () =>
  new URLSearchParams({
    CallSid: 'CA1234567890ABCDE',
    Caller: '+12349013030',
    Digits: '1234',
    From: '+12349013030',
    To: '+18005551212',
  });
const DOCS_SIGNATURE = '0/KCTR6DLpKmkAf8muzZqo1nDgQ=';

Deno.test("signature matches Twilio's published example", async () => {
  assertEquals(await twilioSignature(DOCS_TOKEN, DOCS_URL, docsParams()), DOCS_SIGNATURE);
});

Deno.test('signature does not depend on the order the fields arrive in', async () => {
  const shuffled = new URLSearchParams([...docsParams().entries()].reverse());
  assertEquals(await twilioSignature(DOCS_TOKEN, DOCS_URL, shuffled), DOCS_SIGNATURE);
});

Deno.test('signature matches an SMS webhook signed by the official Twilio library', async () => {
  // Signature produced with the `twilio` npm package for the same inputs.
  const params = new URLSearchParams({
    ToCountry: 'US',
    SmsMessageSid: 'SM00000000000000000000000000000000',
    NumMedia: '0',
    From: '+15550001111',
    To: '+15550002222',
    Body: 'STOP',
    OptOutType: 'STOP',
    AccountSid: 'AC00000000000000000000000000000000',
    ApiVersion: '2010-04-01',
  });
  assertEquals(
    await twilioSignature(
      'test-token',
      'https://abcdefghijklmnop.supabase.co/functions/v1/twilio-inbound',
      params,
    ),
    'THMu7rNIuzZm/Ex263wyUco/L0k=',
  );
});

Deno.test('any change to the token, URL or a field changes the signature', async () => {
  assertNotEquals(await twilioSignature('12346', DOCS_URL, docsParams()), DOCS_SIGNATURE);
  assertNotEquals(
    await twilioSignature(DOCS_TOKEN, 'https://mycompany.com/myapp.php?foo=1&bar=3', docsParams()),
    DOCS_SIGNATURE,
  );
  const tampered = docsParams();
  tampered.set('From', '+12349013031');
  const forged = await twilioSignature(DOCS_TOKEN, DOCS_URL, tampered);
  assertNotEquals(forged, DOCS_SIGNATURE);
  assert(!constantTimeEqual(forged, DOCS_SIGNATURE));
});

Deno.test('STOP keywords', () => {
  for (const body of ['STOP', 'stop', ' Stop ', 'Stop.', 'STOP!', 'stopall', 'Unsubscribe', 'CANCEL', 'end', 'Quit', 'REVOKE', 'optout']) {
    assertEquals(replyKind(body), 'stop', body);
  }
});

Deno.test('START keywords', () => {
  for (const body of ['START', 'start', ' Start. ', 'YES', 'yes', 'UNSTOP']) {
    assertEquals(replyKind(body), 'start', body);
  }
});

Deno.test('ordinary replies are ignored', () => {
  for (const body of ['', 'ok', 'HELP', "don't stop", 'stop it', 'yes please', 'who is this?', '123456', 'STOPPED']) {
    assertEquals(replyKind(body), null, body);
  }
});

Deno.test("Twilio's own OptOutType field is honoured", () => {
  assertEquals(replyKind('ARRET', 'STOP'), 'stop');
  assertEquals(replyKind('whatever', 'start'), 'start');
  assertEquals(replyKind('hello', 'HELP'), null);
  assertEquals(replyKind('hello', null), null);
  // A STOP is never downgraded by a conflicting field.
  assertEquals(replyKind('STOP', 'START'), 'stop');
});

Deno.test('START restores confirmed watchers only', () => {
  assertEquals(statusAfterStart('2026-01-01T00:00:00Z'), 'verified');
  assertEquals(statusAfterStart(null), 'pending');
});

const envOf = (values: Record<string, string>) => (name: string) => values[name];
const ALL = {
  TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token',
  TWILIO_FROM_NUMBER: '+15550002222',
};

Deno.test('simulated mode needs every Twilio secret to be absent', () => {
  assertEquals(twilioMode(envOf({})).kind, 'simulated');
  assertEquals(twilioMode(envOf({ TWILIO_ACCOUNT_SID: '', TWILIO_AUTH_TOKEN: ' ', TWILIO_FROM_NUMBER: '' })).kind, 'simulated');
  assertEquals(twilioMode(envOf(ALL)), {
    kind: 'live',
    accountSid: ALL.TWILIO_ACCOUNT_SID,
    authToken: 'token',
    from: '+15550002222',
  });
});

Deno.test('any one Twilio secret on its own rules simulated mode out', () => {
  const names = Object.keys(ALL) as (keyof typeof ALL)[];
  // Every combination of 1 or 2 secrets out of 3.
  for (let mask = 1; mask < 7; mask++) {
    const some = Object.fromEntries(names.filter((_, i) => mask & (1 << i)).map((n) => [n, ALL[n]]));
    assertEquals(twilioMode(envOf(some)).kind, 'misconfigured', JSON.stringify(Object.keys(some)));
  }
});

Deno.test('Twilio error codes become plain sentences', () => {
  assert(twilioFailureMessage(21608).includes('trial account'));
  assert(twilioFailureMessage(21610).includes('opted out'));
  assertEquals(twilioFailureMessage(21211), twilioFailureMessage(21614));
  assertEquals(twilioFailureMessage(null), "The text couldn't be sent. Try again in a minute.");
  assertEquals(twilioFailureMessage(99999), twilioFailureMessage(null));
});
