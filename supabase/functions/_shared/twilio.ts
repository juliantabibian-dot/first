// Everything that knows about Twilio: sending through its REST API, checking
// that an incoming webhook really came from Twilio, and reading STOP / START.

export type TwilioMode =
  | { kind: 'live'; accountSid: string; authToken: string; from: string }
  /** No Twilio secrets at all: texts are logged but never sent. */
  | { kind: 'simulated' }
  /** Some secrets are set but not all three. Nothing can be sent. */
  | { kind: 'misconfigured' };

const SECRETS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'] as const;

/**
 * Simulated mode needs ALL three secrets to be absent. As soon as any one of
 * them exists the answer is 'live' or 'misconfigured', never 'simulated',
 * because simulated mode shows codes to the owner (see texts.ts).
 */
export function twilioMode(env: (name: string) => string | undefined): TwilioMode {
  const [accountSid, authToken, from] = SECRETS.map((name) => (env(name) ?? '').trim());
  if (accountSid && authToken && from) return { kind: 'live', accountSid, authToken, from };
  if (!accountSid && !authToken && !from) return { kind: 'simulated' };
  return { kind: 'misconfigured' };
}

export type TwilioResult = { ok: true; sid: string } | { ok: false; code: number | null };

export async function sendViaTwilio(
  mode: Extract<TwilioMode, { kind: 'live' }>,
  to: string,
  body: string,
): Promise<TwilioResult> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(mode.accountSid)}/Messages.json`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${mode.accountSid}:${mode.authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: mode.from, Body: body }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && typeof data?.sid === 'string') return { ok: true, sid: data.sid };
    // Twilio's own message can include the phone number, so only the code is logged.
    console.error('Twilio refused a text', res.status, data?.code);
    return { ok: false, code: typeof data?.code === 'number' ? data.code : null };
  } catch (error) {
    console.error('Twilio could not be reached', error instanceof Error ? error.name : error);
    return { ok: false, code: null };
  }
}

/** Turns a Twilio error code into a sentence for the owner. */
export function twilioFailureMessage(code: number | null): string {
  switch (code) {
    case 21211:
    case 21614:
      return "That number can't get texts. Check it and try again.";
    case 21608:
      return "A Twilio trial account can only text numbers verified in the Twilio console. Verify this number there, then try again.";
    case 21610:
      return 'This number has opted out of Lookout texts. They can text START to opt back in.';
    default:
      return "The text couldn't be sent. Try again in a minute.";
  }
}

function base64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/**
 * Twilio signs each webhook: HMAC-SHA1, keyed with the auth token, over the
 * full URL followed by every POST field (sorted by name) as name + value.
 */
export async function twilioSignature(
  authToken: string,
  url: string,
  params: URLSearchParams,
): Promise<string> {
  const fields = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const data = url + fields.map(([name, value]) => name + value).join('');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  return base64(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

const STOP_WORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT'];
const START_WORDS = ['START', 'YES', 'UNSTOP'];

/**
 * Twilio's standard opt-out keywords. The whole message has to be the keyword
 * ("Stop." counts, "don't stop" does not). `optOutType` is a field Twilio adds
 * when it has already recognised the keyword itself.
 */
export function replyKind(body: string, optOutType?: string | null): 'stop' | 'start' | null {
  const word = body.trim().replace(/^[^a-z]+|[^a-z]+$/gi, '').toUpperCase();
  const type = (optOutType ?? '').toUpperCase();
  if (type === 'STOP' || STOP_WORDS.includes(word)) return 'stop';
  if (type === 'START' || START_WORDS.includes(word)) return 'start';
  return null;
}

/**
 * Opting back in only restores what was there before: someone who never
 * confirmed a code still has to.
 */
export function statusAfterStart(verifiedAt: string | null): 'verified' | 'pending' {
  return verifiedAt ? 'verified' : 'pending';
}
