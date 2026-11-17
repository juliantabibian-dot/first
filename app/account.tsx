import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DemoNotice } from '@/components/DemoNotice';
import { Avatar } from '@/components/people';
import { Button, ErrorText, SectionLabel } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmDestructive } from '@/lib/confirm';
import { resetDemo } from '@/lib/demo';
import { formatPhone } from '@/lib/phone';
import { usePhotos } from '@/lib/photos';
import { isDemo } from '@/lib/supabase';
import { type, useTheme } from '@/lib/theme';
import { callFunction, useWatchers } from '@/lib/watchers';

const LIMITS = [
  'Lookout only knows about the copy of a photo inside the app. Once a photo is downloaded or shared, it is out of Lookout’s hands; that is why your watchers are told.',
  'iPhone blanks screenshots and screen recordings of your photos, and a screenshot of an open photo texts its watchers.',
  'Nothing can stop someone taking a picture of the screen with another phone or camera.',
];

function Stat({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[type.title, styles.statValue, { color: alert ? t.alert : t.ink }]}>{value}</Text>
      <Text style={[type.footnote, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

export default function Account() {
  const t = useTheme();
  const { profile, session, signOut } = useAuth();
  const { watchers } = useWatchers();
  const [busy, setBusy] = useState<'reset' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const phone = session?.user.phone;
  const { photos } = usePhotos();
  const verified = watchers.filter((w) => w.status === 'verified');
  const confirmed = verified.length;
  const watchedCount = photos.filter((p) => verified.some((w) => p.watcherIds.includes(w.id))).length;

  async function reset() {
    const agreed = await confirmDestructive(
      'Erase the demo?',
      'Every photo, watcher and text in this demo is deleted from this phone, and you are signed out.',
      'Erase',
    );
    if (!agreed) return;
    setBusy('reset');
    await resetDemo();
    await signOut();
  }

  async function deleteAccount() {
    const agreed = await confirmDestructive(
      'Delete your account?',
      `Your photos, watchers and history are deleted for good. This can't be undone.${
        confirmed
          ? ` Your ${confirmed === 1 ? 'watcher gets' : `${confirmed} watchers get`} a text saying your account was deleted.`
          : ''
      }`,
      'Delete account',
    );
    if (!agreed) return;
    setError('');
    setBusy('delete');
    const result = await callFunction('delete-account', {});
    if (!result.ok) {
      setBusy(null);
      setError(result.error);
      return;
    }
    await signOut();
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <View style={styles.who}>
        <Avatar name={profile?.name ?? '?'} size={56} />
        <View style={styles.whoText}>
          <Text style={[type.title, { color: t.ink }]}>{profile?.name}</Text>
          {phone ? (
            <Text style={[type.callout, styles.phone, { color: t.muted }]}>{formatPhone(phone)}</Text>
          ) : null}
        </View>
      </View>
      <View style={[styles.stats, { backgroundColor: t.fill }]}>
        <Stat value={photos.length} label={photos.length === 1 ? 'photo' : 'photos'} />
        <View style={[styles.statRule, { backgroundColor: t.line }]} />
        <Stat value={confirmed} label={confirmed === 1 ? 'watcher' : 'watchers'} />
        <View style={[styles.statRule, { backgroundColor: t.line }]} />
        <Stat value={photos.length - watchedCount} label="unwatched" alert={photos.length - watchedCount > 0} />
      </View>
      <View style={styles.demo}>
        <DemoNotice>
          This copy of Lookout isn't connected to a server. Nothing is texted to anyone, and
          everything you add is kept only on this phone.
        </DemoNotice>
      </View>

      <SectionLabel>What Lookout can and can't do</SectionLabel>
      {LIMITS.map((line) => (
        <Text key={line} style={[type.callout, styles.limit, { color: t.muted }]}>
          {line}
        </Text>
      ))}

      <View style={styles.buttons}>
        <Button title="Sign out" variant="ghost" onPress={signOut} disabled={busy !== null} />
        {isDemo ? (
          <Button
            title="Erase the demo"
            variant="danger"
            onPress={reset}
            loading={busy === 'reset'}
            disabled={busy !== null}
          />
        ) : (
          <>
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button
              title="Delete account"
              variant="danger"
              onPress={deleteAccount}
              loading={busy === 'delete'}
              disabled={busy !== null}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, width: '100%', maxWidth: 560, alignSelf: 'center' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  whoText: { flex: 1, minWidth: 0 },
  phone: { marginTop: 2, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, marginTop: 20, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontVariant: ['tabular-nums'] },
  statRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  demo: { marginTop: 20, marginBottom: -24 },
  limit: { marginBottom: 10 },
  buttons: { gap: 10, marginTop: 22 },
});
