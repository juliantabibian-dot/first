import { FunctionsHttpError } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';

/**
 * pending   = texted a code, not confirmed yet
 * verified  = confirmed; can be assigned to photos and gets alerts
 * opted_out = replied STOP; Lookout must not text them
 */
export type WatcherStatus = 'pending' | 'verified' | 'opted_out';

export type Watcher = {
  id: string;
  name: string;
  phone_e164: string;
  status: WatcherStatus;
  verified_at: string | null;
  /**
   * Confirmed while texts were only simulated, so they never got a real code.
   * The server won't send them real texts; they have to be removed and added again.
   */
  verified_simulated: boolean;
  created_at: string;
};

/** What a server function answered: its data, or a sentence to show as is. */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** `simulated` is true while Twilio isn't connected: the text was only logged. */
type Sent = { simulated: boolean };

type WatchersState = {
  watchers: Watcher[];
  loading: boolean;
  error: string | null;
  pendingCount: number;
  refresh: () => Promise<void>;
  add: (name: string, phone: string) => Promise<Result<Sent>>;
  resendCode: (id: string) => Promise<Result<Sent>>;
  confirm: (id: string, code: string) => Promise<Result<Sent>>;
  sendTest: (id: string) => Promise<Result<Sent>>;
  remove: (id: string) => Promise<Result<{ texted: boolean }>>;
};

const WatchersContext = createContext<WatchersState | null>(null);

/**
 * The app can only read watchers. Every change goes through a server function,
 * because the server is what texts the watcher about it.
 */
async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<Result<T>> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return { ok: true, data };
  // On a non-2xx answer the error's `context` is the Response; our functions
  // put the sentence for the user in its JSON body.
  if (error instanceof FunctionsHttpError) {
    const response: Response = error.context;
    const sentence = await response.json().then(
      (json) => json?.error,
      () => null,
    );
    if (typeof sentence === 'string' && sentence) return { ok: false, error: sentence };
    if (response.status === 404) {
      return {
        ok: false,
        error: "Texting isn't set up on the server yet: the functions haven't been deployed.",
      };
    }
  }
  return { ok: false, error: "Couldn't reach Lookout. Check your connection and try again." };
}

export function WatchersProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  const userId = profile ? (session?.user.id ?? null) : null;

  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data, error: loadError } = await supabase
      .from('watchers')
      .select('id, name, phone_e164, status, verified_at, verified_simulated, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (loadError) {
      setError("Couldn't load your watchers. Pull down to try again.");
    } else {
      setWatchers(data);
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setWatchers([]);
    setError(null);
    setLoading(true);
    refresh();
  }, [refresh]);

  // Reload after every call, failed ones too: a refusal often means the list is out of date.
  const change = useCallback(
    async <T,>(name: string, body: Record<string, unknown>) => {
      const result = await callFunction<T>(name, body);
      await refresh();
      return result;
    },
    [refresh],
  );

  const value = useMemo<WatchersState>(
    () => ({
      watchers,
      loading,
      error,
      pendingCount: watchers.filter((w) => w.status === 'pending').length,
      refresh,
      add: (name, phone) => change('send-watcher-code', { name, phone }),
      resendCode: (id) => change('send-watcher-code', { watcher_id: id }),
      confirm: (id, code) => change('verify-watcher-code', { watcher_id: id, code }),
      sendTest: (id) => change('send-test-text', { watcher_id: id }),
      remove: (id) => change('remove-watcher', { watcher_id: id }),
    }),
    [watchers, loading, error, refresh, change],
  );

  return <WatchersContext.Provider value={value}>{children}</WatchersContext.Provider>;
}

export function useWatchers(): WatchersState {
  const ctx = useContext(WatchersContext);
  if (!ctx) throw new Error('useWatchers must be used inside WatchersProvider');
  return ctx;
}
