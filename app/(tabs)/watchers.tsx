import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { AccountButton } from '@/components/AccountButton';
import { Avatar } from '@/components/people';
import {
  Button,
  Divider,
  ErrorText,
  Field,
  NoteText,
  ScreenHeader,
  SectionLabel,
  TextButton,
} from '@/components/ui';
import { confirmDestructive } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { formatPhone, toE164 } from '@/lib/phone';
import { usePhotos } from '@/lib/photos';
import { type, useTheme } from '@/lib/theme';
import { useWatchers, type Watcher } from '@/lib/watchers';
import { Text, TextInput } from '@/components/Text';

/** A line under a form or row: what just happened, or why it didn't. */
type Note = { kind: 'ok' | 'error'; text: string } | null;

function NoteLine({ note }: { note: Note }) {
  if (!note) return null;
  return note.kind === 'error' ? <ErrorText>{note.text}</ErrorText> : <NoteText>{note.text}</NoteText>;
}

/** Folded into one row once there is someone on the list, since the list matters more then. */
function AddWatcher() {
  const t = useTheme();
  const { watchers, add } = useWatchers();
  /** null until the person opens or closes it: then it is open only while the list is empty. */
  const [chosen, setOpen] = useState<boolean | null>(null);
  const open = chosen ?? !watchers.length;
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
    if (!result.ok) {
      haptic.error();
      return fail(result.error);
    }
    haptic.success();
    setName('');
    setPhone('');
    setOpen(false);
    setNote({
      kind: 'ok',
      text: result.data.simulated
        ? `Nothing was really sent. ${trimmed}'s code is in the Texts tab.`
        : `Code texted to ${trimmed}. Ask them for it and enter it below.`,
    });
  }

  if (!open) {
    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a watcher"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.addRow, { backgroundColor: t.fill, opacity: pressed ? 0.7 : 1 }]}>
          <View style={[styles.addIcon, { borderColor: t.muted }]}>
            <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={t.ink} size={16} />
          </View>
          <View style={styles.flex}>
            <Text style={[type.headline, { color: t.ink }]}>Add a watcher</Text>
            <Text style={[type.footnote, { color: t.muted }]}>A phone number. They don't need the app.</Text>
          </View>
        </Pressable>
        {note ? (
          <View style={styles.addNote}>
            <NoteLine note={note} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <SectionLabel>Add a watcher</SectionLabel>
      <Text style={[type.footnote, styles.blurb, { color: t.muted }]}>
        They don't need the app. We text them a 6-digit code; ask them for it and enter it here to
        confirm the number.
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
        style={{ fontVariant: ['tabular-nums'] }}
      />
      <NoteLine note={note} />
      <Button title="Text them a code" onPress={submit} loading={busy} />
      {watchers.length ? (
        <View style={styles.addCancel}>
          <TextButton
            title="Cancel"
            disabled={busy}
            onPress={() => {
              setOpen(false);
              setNote(null);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const STATUS = {
  pending: 'Waiting for code',
  verified: 'Confirmed',
  opted_out: 'Opted out',
} as const;

function WatcherRow({ watcher, onRemoved }: { watcher: Watcher; onRemoved: (text: string) => void }) {
  const t = useTheme();
  const { confirm, resendCode, sendTest, remove } = useWatchers();
  const { photos, refresh: refreshPhotos } = usePhotos();
  const watchingCount = photos.filter((p) => p.watcherIds.includes(watcher.id)).length;
  const [code, setCode] = useState('');
  /** Which action's request is in flight; every control in the row is disabled meanwhile. */
  const [busy, setBusy] = useState<'confirm' | 'resend' | 'test' | 'remove' | null>(null);
  const [note, setNote] = useState<Note>(null);
  const { id, name, status } = watcher;

  async function run<T>(
    action: NonNullable<typeof busy>,
    request: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>,
    done: (data: T) => string | null,
  ) {
    setNote(null);
    setBusy(action);
    const result = await request();
    setBusy(null);
    if (!result.ok) {
      haptic.error();
      return setNote({ kind: 'error', text: result.error });
    }
    if (action === 'confirm') haptic.success();
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
          ? 'Nothing was really sent. The new code is in the Texts tab.'
          : `New code texted to ${name}.`;
      },
    );
  const onTest = () =>
    run(
      'test',
      () => sendTest(id),
      (sent) =>
        sent.simulated
          ? 'Nothing was really sent. See the test in the Texts tab.'
          : `Test text sent to ${name}.`,
    );

  async function onRemove() {
    const agreed = await confirmDestructive(
      `Remove ${name}?`,
      status === 'verified'
        ? `${name} will get a text saying you removed them as a watcher${
            watchingCount ? ` on ${watchingCount} ${watchingCount === 1 ? 'photo' : 'photos'}` : ''
          }.`
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
        refreshPhotos();
        onRemoved(texted ? `${name} was removed and got a text about it.` : `${name} was removed.`);
        return null;
      },
    );
  }

  // Green means this person is actually watching; anything else is a hollow dot.
  const live = status === 'verified';

  return (
    <View style={styles.row}>
      <View style={[styles.rowAvatar, !live && { opacity: 0.45 }]}>
        <Avatar name={name} size={40} />
      </View>
      <View style={styles.rowBody}>
      <View style={styles.nameLine}>
        <Text style={[type.headline, styles.name, { color: t.ink }]} numberOfLines={1}>
          {name}
        </Text>
        <View
          style={[
            styles.dot,
            live ? { backgroundColor: t.watching } : { borderWidth: 1.5, borderColor: t.muted },
          ]}
        />
        <Text style={[type.footnote, { color: live ? t.ink : t.muted }]}>{STATUS[status]}</Text>
      </View>
      <Text style={[type.callout, styles.phone, { color: t.muted }]}>
        {formatPhone(watcher.phone_e164)}
        {status === 'verified'
          ? ` · watching ${watchingCount} ${watchingCount === 1 ? 'photo' : 'photos'}`
          : ''}
      </Text>

      {status === 'opted_out' ? (
        <Text style={[type.footnote, styles.explain, { color: t.muted }]}>
          They replied STOP, so they won't get any texts from Lookout. They can text START to opt
          back in.
        </Text>
      ) : null}

      {status === 'verified' && watcher.verified_simulated ? (
        <Text style={[type.footnote, styles.explain, { color: t.warn }]}>
          Confirmed before real texting was connected, so they never got a real code. Once texting
          works, remove them and add them again or they won't get alerts.
        </Text>
      ) : null}

      {status === 'pending' ? (
        <View style={styles.codeLine}>
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
              { backgroundColor: t.fill, color: t.ink },
              code ? styles.codeTyped : null,
            ]}
          />
          <Button
            compact
            title="Confirm"
            onPress={onConfirm}
            loading={busy === 'confirm'}
            disabled={busy !== null || code.length !== 6}
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        {status === 'pending' ? (
          <TextButton
            title="Text a new code"
            onPress={onResend}
            loading={busy === 'resend'}
            disabled={busy !== null}
          />
        ) : null}
        {status === 'verified' ? (
          <TextButton
            title="Send test text"
            onPress={onTest}
            loading={busy === 'test'}
            disabled={busy !== null}
          />
        ) : null}
        <TextButton
          title="Remove"
          tone="danger"
          onPress={onRemove}
          loading={busy === 'remove'}
          disabled={busy !== null}
        />
      </View>
      {note ? (
        <View style={styles.rowNote}>
          <NoteLine note={note} />
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
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <ScreenHeader title="Watchers" right={<AccountButton />} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={t.muted} />
        }>
        {watchers.length ? (
          <>
            <SectionLabel>
              {watchers.length} {watchers.length === 1 ? 'watcher' : 'watchers'}
            </SectionLabel>
            {error ? <ErrorText>{error}</ErrorText> : null}
            {removed ? <NoteText>{removed}</NoteText> : null}
            {watchers.map((w, index) => (
              <View key={w.id}>
                {index ? <Divider inset={54} /> : null}
                <WatcherRow watcher={w} onRemoved={setRemoved} />
              </View>
            ))}
          </>
        ) : loading ? (
          <ActivityIndicator color={t.muted} style={{ marginTop: 24 }} />
        ) : (
          <>
            {error ? <ErrorText>{error}</ErrorText> : null}
            {removed ? <NoteText>{removed}</NoteText> : null}
            <Text style={[type.callout, styles.intro, { color: t.muted }]}>
              Watchers are the people who get a text when one of your photos is shared, saved or
              screenshotted. Start with someone you trust.
            </Text>
          </>
        )}
        {/* Always in the same place, so a note under it survives the list appearing. */}
        <View style={watchers.length ? styles.addAfter : null}>
          {loading && !watchers.length ? null : <AddWatcher />}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  blurb: { marginTop: -2, marginBottom: 16 },
  flex: { flex: 1 },
  intro: { marginTop: 4, marginBottom: 4 },
  addAfter: { marginTop: 20 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 14 },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNote: { marginTop: 10, marginBottom: -12 },
  addCancel: { alignItems: 'center', marginTop: 16 },
  row: { flexDirection: 'row', gap: 14, paddingVertical: 16 },
  rowAvatar: { paddingTop: 2 },
  rowBody: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, marginRight: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  phone: { marginTop: 2, fontVariant: ['tabular-nums'] },
  explain: { marginTop: 8 },
  codeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  code: { flex: 1, minWidth: 120, minHeight: 44, borderRadius: 10, paddingHorizontal: 14, fontSize: 17 },
  codeTyped: { letterSpacing: 3, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 22, marginTop: 12 },
  rowNote: { marginTop: 10, marginBottom: -12 },
});
