import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DemoNotice } from '@/components/DemoNotice';
import { Button, Card, ErrorText } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmDestructive } from '@/lib/confirm';
import { resetDemo } from '@/lib/demo';
import { formatPhone } from '@/lib/phone';
import { isDemo } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { callFunction, useWatchers } from '@/lib/watchers';

const LIMITS = [
  'Lookout only knows about the copy of a photo inside the app. Once a photo is downloaded or shared, it is out of Lookout’s hands; that is why your watchers are told.',
  'iPhone blanks screenshots and screen recordings of your photos, and a screenshot of an open photo texts its watchers.',
  'Nothing can stop someone taking a picture of the screen with another phone or camera.',
];

export default function Account() {
  const t = useTheme();
  const { profile, session, signOut } = useAuth();
  const { watchers } = useWatchers();
  const [busy, setBusy] = useState<'reset' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const phone = session?.user.phone;
  const confirmed = watchers.filter((w) => w.status === 'verified').length;

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
      <Text style={[styles.name, { color: t.ink }]}>{profile?.name}</Text>
      {phone ? <Text style={[styles.phone, { color: t.muted }]}>{formatPhone(phone)}</Text> : null}
      <DemoNotice>
        This copy of Lookout isn't connected to a server. Nothing is texted to anyone, and
        everything you add is kept only on this phone.
      </DemoNotice>

      <Card>
        <Text style={[styles.cardTitle, { color: t.ink }]}>What Lookout can and can't do</Text>
        {LIMITS.map((line) => (
          <View key={line} style={styles.limit}>
            <Text style={[styles.bullet, { color: t.muted }]}>•</Text>
            <Text style={[styles.limitText, { color: t.muted }]}>{line}</Text>
          </View>
        ))}
      </Card>

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
  content: { padding: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  name: { fontSize: 22, fontWeight: '700' },
  phone: { fontSize: 15, marginTop: 2, marginBottom: 20 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  limit: { flexDirection: 'row', gap: 8, marginTop: 6 },
  bullet: { fontSize: 14, lineHeight: 20 },
  limitText: { flex: 1, fontSize: 14, lineHeight: 20 },
  buttons: { gap: 8, marginTop: 16 },
});
