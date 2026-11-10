import { must, rows, type Db } from './db.ts';
import { sendViaTwilio, twilioFailureMessage, twilioMode } from './twilio.ts';
import type { Watcher } from './watchers.ts';

export type TextOutcome =
  | { status: 'sent' | 'simulated' }
  | { status: 'failed'; message: string }
  /** Nothing was sent or logged because this person must not be texted. */
  | { status: 'skipped'; message: string };

type TextRequest = {
  ownerId: string;
  watcher: Pick<Watcher, 'id' | 'name' | 'phone_e164' | 'status' | 'verified_simulated'>;
  /** What the watcher receives. */
  body: string;
  /**
   * What the owner sees in their history, when that must differ from `body`.
   * Used for code texts: the owner can read the texts table, so storing the
   * real code there would let them confirm a number without asking its owner.
   */
  storedBody?: string;
  eventId?: string;
};

/** The one place a text is sent from. Every text is logged to `texts` before it goes out. */
export async function sendText(db: Db, request: TextRequest): Promise<TextOutcome> {
  const { watcher } = request;
  const mode = twilioMode((name) => Deno.env.get(name));

  if (watcher.status === 'opted_out') {
    return { status: 'skipped', message: `${watcher.name} replied STOP, so Lookout can't text them.` };
  }
  if (watcher.verified_simulated && mode.kind !== 'simulated') {
    return {
      status: 'skipped',
      message: `${watcher.name} was confirmed before texting was connected, so they never got a real code. Remove them and add them again.`,
    };
  }

  const row = {
    owner_id: request.ownerId,
    watcher_id: watcher.id,
    watcher_name: watcher.name,
    watcher_phone: watcher.phone_e164,
    event_id: request.eventId ?? null,
  };

  if (mode.kind === 'simulated') {
    // SIMULATED MODE ONLY. Twilio is not connected, so nothing leaves the
    // server and the Texts tab is the only place this message exists. It is
    // stored exactly as it would have been sent, INCLUDING a real code, so the
    // owner can finish the flow while trying the app out. twilioMode() returns
    // 'simulated' only while all three Twilio secrets are absent, so this
    // branch cannot run once any of them is set. Watchers confirmed this way
    // are flagged (verified_simulated) and are never sent a real text.
    must(await db.from('texts').insert({ ...row, body: request.body, status: 'simulated' }));
    return { status: 'simulated' };
  }

  const stored = request.storedBody ?? request.body;

  if (mode.kind === 'misconfigured') {
    must(await db.from('texts').insert({ ...row, body: stored, status: 'failed' }));
    return {
      status: 'failed',
      message: "Texting isn't set up correctly. All three Twilio secrets need to be set.",
    };
  }

  const logged = rows(
    await db.from('texts').insert({ ...row, body: stored, status: 'queued' }).select('id').single(),
  );
  const result = await sendViaTwilio(mode, watcher.phone_e164, request.body);
  const update = result.ok
    ? { status: 'sent', twilio_sid: result.sid }
    : { status: 'failed', twilio_sid: null };
  const { error } = await db.from('texts').update(update).eq('id', logged.id);
  if (error) console.error('Could not record the result of a text', error);

  return result.ok
    ? { status: 'sent' }
    : { status: 'failed', message: twilioFailureMessage(result.code) };
}
