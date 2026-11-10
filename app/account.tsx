import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DemoNotice } from '@/components/DemoNotice';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirmDestructive } from '@/lib/confirm';
import { resetDemo } from '@/lib/demo';
import { formatPhone } from '@/lib/phone';
import { isDemo } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Account() {
  const t = useTheme();
  const { profile, session, signOut } = useAuth();
  const [resetting, setResetting] = useState(false);
  const phone = session?.user.phone;

  async function reset() {
    const agreed = await confirmDestructive(
      'Erase the demo?',
      'Every photo, watcher and text in this demo is deleted from this phone, and you are signed out.',
      'Erase',
    );
    if (!agreed) return;
    setResetting(true);
    await resetDemo();
    await signOut();
  }

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <Text style={[styles.name, { color: t.ink }]}>{profile?.name}</Text>
      {phone ? <Text style={[styles.phone, { color: t.muted }]}>{formatPhone(phone)}</Text> : null}
      <DemoNotice>
        This copy of Lookout isn't connected to a server. Nothing is texted to anyone, and
        everything you add is kept only on this phone.
      </DemoNotice>
      <Button title="Sign out" variant="ghost" onPress={signOut} disabled={resetting} />
      {isDemo ? (
        <View style={styles.gap}>
          <Button title="Erase the demo" variant="danger" onPress={reset} loading={resetting} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  name: { fontSize: 22, fontWeight: '700' },
  phone: { fontSize: 15, marginTop: 2, marginBottom: 20 },
  gap: { marginTop: 8 },
});
