import { router, Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, type ColorValue } from 'react-native';

import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useWatchers } from '@/lib/watchers';

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function AccountButton() {
  const t = useTheme();
  const { profile } = useAuth();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account"
      hitSlop={6}
      onPress={() => router.push('/account')}
      style={[styles.avatar, { backgroundColor: t.accent }]}>
      <Text style={[styles.avatarText, { color: t.onAccent }]}>
        {initials(profile?.name ?? '?')}
      </Text>
    </Pressable>
  );
}

const icon =
  (name: SymbolViewProps['name']) =>
  ({ color }: { color: ColorValue }) => <SymbolView name={name} tintColor={color} size={26} />;

export default function TabLayout() {
  const t = useTheme();
  const { pendingCount } = useWatchers();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.accent,
        tabBarBadgeStyle: { backgroundColor: t.danger, color: t.onAccent },
        headerRight: () => <AccountButton />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Photos',
          tabBarIcon: icon({ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }),
        }}
      />
      <Tabs.Screen
        name="watchers"
        options={{
          title: 'Watchers',
          // Watchers still waiting for their code to be entered.
          tabBarBadge: pendingCount || undefined,
          tabBarIcon: icon({ ios: 'eye', android: 'visibility', web: 'visibility' }),
        }}
      />
      <Tabs.Screen
        name="texts"
        options={{
          title: 'Texts sent',
          tabBarLabel: 'Texts',
          tabBarIcon: icon({ ios: 'message', android: 'chat', web: 'chat' }),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '700' },
});
