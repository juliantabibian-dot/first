import { router } from 'expo-router';
import {
  Pressable,
  StyleSheet,
} from 'react-native';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/Text';

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** The round initials button in each tab's header; opens the Account screen. */
export function AccountButton() {
  const t = useTheme();
  const { profile } = useAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account"
      hitSlop={8}
      onPress={() => router.push('/account')}
      style={({ pressed }) => [styles.button, { backgroundColor: t.fill, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.text, { color: t.ink }]}>{initials(profile?.name ?? '?')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 13, fontWeight: '600' },
});
