import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, Card, ErrorText, Field } from '@/components/ui';
import { confirmDestructive } from '@/lib/confirm';
import { formatPhone, toE164 } from '@/lib/phone';
import { useTheme } from '@/lib/theme';
import { useWatchers, type Watcher } from '@/lib/watchers';

/** A line under a form or row: what just happened, or why it didn't. */
type Note = { kind: 'ok' | 'error'; text: string } | null;

function NoteText({ note }: { note: Note }) {
  const t = useTheme();
  if (!note) return null;
  if (note.kind === 'error') return <ErrorText>{note.text}</ErrorText>;
  return <Text style={[styles.ok, { color: t.ok }]}>{note.text}</Text>;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function AddWatcher() {
  const t = useTheme();
  const { watchers, add } = useWatchers();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  async function submit() {
    const fail = (text: string) => setNote({ kind: 'error', text });
    const trimmed = name.trim();
    const e164 = toE164(phone);
    if (!trimmed) return fail('Enter their name.');
    if (!e164) return fail("That doesn't look like a full phone number.");
    if (watchers.some((w) => w.phone_e164 === e164)) {
      return fail('That number is already on your list.');
    }

    setNote(null);
    setBusy(true);
    const result = await add(trimmed, e164);
    setBusy(false);
    if (!result.ok) return fail(result.error);
    setName('');
    setPhone('');
    setNote({
      kind: 'ok',
      text: result.data.simulated
        ? `Texting isn't connected yet, so nothing was sent. ${trimmed}'s code is in the Texts tab.`
        : `Code texted to ${trimmed}. Ask them for it and enter it below.`,
    });
  }

  return (
    <Card>
      <Text style={[styles.cardTitle, { color: t.ink }]}>Add a watcher</Text>
      <Text style={[styles.blurb, { color: t.muted }]}>
        They don't need the app. We text them a 6-digit code. Ask them for it and enter it here to
        confirm the number works.
      </Text>
      <Field
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Mom"
        maxLength={30}
        autoCapitalize="words"
        autoCorrect={false}
        editable={!busy}
      />
      <Field
        label="Phone number"
        value={phone}
        onChangeText={setPhone}
        placeholder="(555) 123-4567"
        keyboardType="phone-pad"
        autoComplete="off"
        editable={!busy}
      />
      <NoteText note={note} />
      <Button title="Text them a code" onPress={submit} loading={busy} />
    </Card>
  );
}

const PILLS = {
  pending: { label: 'Waiting for code', fg: 'warn', bg: 'warnSoft' },
  verified: { label: 'Confirmed', fg: 'ok', bg: 'okSoft' },
  opted_out: { label: 'Opted out', fg: 'muted', bg: 'line' },
} as const;

function WatcherRow({
  watcher,
  first,
  onRemoved,
}: {
  watcher: Watcher;
  first: boolean;
  onRemoved: (text: string) => void;
}) {
  const t = useTheme();
  const { confirm, resendCode, sendTest, remove } = useWatchers();
  const [code, setCode] = useState('');
  /** Which button's request is in flight; every button in the row is disabled meanwhile. */
  const [busy, setBusy] = useState<'confirm' | 'resend' | 'test' | 'remove' | null>(null);
  const [note, setNote] = useState<Note>(null);
  const { id, name, status } = watcher;
  const pill = PILLS[status];

  async function run<T>(
    action: NonNullable<typeof busy>,
    request: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    done: (data: T) => string | null,
  ) {
    setNote(null);
    setBusy(action);
    const result = await request();
    setBusy(null);
    if (!result.ok) return setNote({ kind: 'error', text: result.error });
    const text = done(result.data);
    if (text) setNote({ kind: 'ok', text });
  }

  const onConfirm = () =>
    run(
      'confirm',
      () => confirm(id, code),
      () => {
        setCode('');
        return `${name} is confirmed.`;
      },
    );
  const onResend = () =>
    run(
      'resend',
      () => resendCode(id),
      (sent) => {
        setCode('');
        return sent.simulated
          ? "Texting isn't connected yet. The new code is in the Texts tab."
          : `New code texted to ${name}.`;
      },
    );
  const onTest = () =>
    run(
      'test',
      () => sendTest(id),
      (sent) =>
        sent.simulated
          ? "Texting isn't connected yet. See the test in the Texts tab."
          : `Test text sent to ${name}.`,
    );

  async function onRemove() {
    const agreed = await confirmDestructive(
      `Remove ${name}?`,
      status === 'verified'
        ? `${name} will get a text saying you removed them as a watcher.`
        : status === 'pending'
          ? "They haven't confirmed, so they won't be texted about it."
          : "They opted out of texts, so they won't be texted about it.",
      'Remove',
    );
    if (!agreed) return;
    run(
      'remove',
      () => remove(id),
      ({ texted }) => {
        onRemoved(texted ? `${name} was removed and got a text about it.` : `${name} was removed.`);
        return null;
      },
    );
  }

  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: t.line }]}>
      <View style={[styles.avatar, { backgroundColor: status === 'verified' ? t.accent : t.line }]}>
        <Text
          style={[styles.avatarText, { color: status === 'verified' ? t.onAccent : t.muted }]}>
          {initials(name)}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.nameLine}>
          <Text style={[styles.name, { color: t.ink }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={[styles.pill, { backgroundColor: t[pill.bg] }]}>
            <Text style={[styles.pillText, { color: t[pill.fg] }]}>{pill.label}</Text>
          </View>
        </View>
        <Text style={[styles.phone, { color: t.muted }]}>{formatPhone(watcher.phone_e164)}</Text>

        {status === 'opted_out' ? (
          <Text style={[styles.explain, { color: t.muted }]}>
            They replied STOP, so they won't get any texts from Lookout. They can text START to
            opt back in.
          </Text>
        ) : null}

        {status === 'verified' && watcher.verified_simulated ? (
          <Text style={[styles.explain, { color: t.warn }]}>
            Confirmed before real texting was connected, so they never got a real code. Once
            texting works, remove them and add them again or they won't get alerts.
          </Text>
        ) : null}

        {status === 'pending' ? (
          <View style={styles.actions}>
            <TextInput
              accessibilityLabel={`Code ${name} got`}
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
              placeholder="Code they got"
              placeholderTextColor={t.muted}
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="off"
              editable={!busy}
              onSubmitEditing={code.length === 6 ? onConfirm : undefined}
              style={[
                styles.code,
                { borderColor: t.line, backgroundColor: t.field, color: t.ink },
                code ? styles.codeTyped : null,
              ]}
            />
            <Button
              small
              title="Confirm"
              onPress={onConfirm}
              loading={busy === 'confirm'}
              disabled={busy !== null || code.length !== 6}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          {status === 'pending' ? (
            <Button
              small
              variant="ghost"
              title="Text a new code"
              onPress={onResend}
              loading={busy === 'resend'}
              disabled={busy !== null}
            />
          ) : null}
          {status === 'verified' ? (
            <Button
              small
              variant="ghost"
              title="Send test text"
              onPress={onTest}
              loading={busy === 'test'}
              disabled={busy !== null}
            />
          ) : null}
          <Button
            small
            variant="danger"
            title="Remove"
            onPress={onRemove}
            loading={busy === 'remove'}
            disabled={busy !== null}
          />
        </View>
        {note ? (
          <View style={styles.rowNote}>
            <NoteText note={note} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function Watchers() {
  const t = useTheme();
  const { watchers, loading, error, refresh } = useWatchers();
  const [refreshing, setRefreshing] = useState(false);
  const [removed, setRemoved] = useState<string | null>(null);

  // A watcher can opt out by text at any time, so check again whenever the tab is opened.
  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => setRemoved(null);
    }, [refresh]),
  );

  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={t.muted} />
      }>
      <AddWatcher />

      <Text style={[styles.section, { color: t.muted }]}>My watchers · {watchers.length}</Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {removed ? <NoteText note={{ kind: 'ok', text: removed }} /> : null}

      {watchers.length ? (
        <Card>
          {watchers.map((w, index) => (
            <WatcherRow key={w.id} watcher={w} first={index === 0} onRemoved={setRemoved} />
          ))}
        </Card>
      ) : loading ? (
        <ActivityIndicator color={t.muted} style={{ marginTop: 24 }} />
      ) : error ? null : (
        <Card>
          <Text style={[styles.empty, { color: t.muted }]}>No one yet.</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  blurb: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  ok: { fontSize: 13, marginBottom: 10 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 14 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700' },
  rowBody: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  phone: { fontSize: 13, marginTop: 2 },
  explain: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 },
  code: {
    flex: 1,
    minWidth: 120,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  codeTyped: { letterSpacing: 3, fontVariant: ['tabular-nums'] },
  rowNote: { marginTop: 10, marginBottom: -10 },
});
