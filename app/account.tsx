import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/phone';
import { useTheme } from '@/lib/theme';

export default function Account() {
  const t = useTheme();
  const { profile, session, signOut } = useAuth();
  const phone = session?.user.phone;

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <Text style={[styles.name, { color: t.ink }]}>{profile?.name}</Text>
      {phone ? <Text style={[styles.phone, { color: t.muted }]}>{formatPhone(phone)}</Text> : null}
      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  name: { fontSize: 22, fontWeight: '700' },
  phone: { fontSize: 15, marginTop: 2, marginBottom: 20 },
});
