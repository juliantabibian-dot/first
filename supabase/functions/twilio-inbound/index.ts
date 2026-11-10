// Twilio calls this when someone replies to a Lookout text. It only acts on
// STOP and START. Twilio can't send a Supabase sign-in token, so this function
// is deployed with --no-verify-jwt and the Twilio signature is the ONLY thing
// protecting it: anything without a valid signature is rejected.
import { constantTimeEqual } from '../_shared/codes.ts';
import { adminClient, must, rows, secret } from '../_shared/db.ts';
import { replyKind, statusAfterStart, twilioSignature } from '../_shared/twilio.ts';

const E164 = /^\+[1-9][0-9]{7,14}$/;
const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/**
 * The signature covers the exact URL Twilio was given, which is not reliably
 * what the function sees as req.url behind Supabase's gateway. So it is built
 * from the project URL, or taken from TWILIO_WEBHOOK_URL if the webhook was
 * set up with a different address (a custom domain, or extra ?query).
 */
function webhookUrl(): string {
  const override = (Deno.env.get('TWILIO_WEBHOOK_URL') ?? '').trim();
  return override || `${secret('SUPABASE_URL').replace(/\/+$/, '')}/functions/v1/twilio-inbound`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const authToken = (Deno.env.get('TWILIO_AUTH_TOKEN') ?? '').trim();
    const signature = req.headers.get('X-Twilio-Signature') ?? '';
    const params = new URLSearchParams(await req.text());
    const genuine =
      authToken !== '' &&
      signature !== '' &&
      constantTimeEqual(await twilioSignature(authToken, webhookUrl(), params), signature);
    if (!genuine) return new Response('Forbidden', { status: 403 });

    const from = params.get('From') ?? '';
    const kind = replyKind(params.get('Body') ?? '', params.get('OptOutType'));
    if (kind && E164.test(from)) {
      const db = adminClient();
      // The same person can be on several owners' lists; STOP covers all of them.
      if (kind === 'stop') {
        must(await db.from('watchers').update({ status: 'opted_out' }).eq('phone_e164', from));
      } else {
        const optedOut: { id: string; verified_at: string | null }[] = rows(
          await db
            .from('watchers')
            .select('id, verified_at')
            .eq('phone_e164', from)
            .eq('status', 'opted_out'),
        );
        for (const status of ['verified', 'pending'] as const) {
          const ids = optedOut.filter((w) => statusAfterStart(w.verified_at) === status).map((w) => w.id);
          if (!ids.length) continue;
          must(await db.from('watchers').update({ status }).in('id', ids).eq('status', 'opted_out'));
        }
      }
    }
    return new Response(EMPTY_TWIML, { headers: { 'Content-Type': 'text/xml' } });
  } catch (error) {
    console.error(error);
    return new Response('Server error', { status: 500 });
  }
});
