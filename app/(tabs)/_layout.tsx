import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { type ColorValue } from 'react-native';

import { fontFor } from '@/lib/fonts';
import { hairline, useTheme } from '@/lib/theme';
import { useWatchers } from '@/lib/watchers';

/** Outline when idle, filled when selected, as in Apple's own apps. */
const icon =
  (idle: SymbolViewProps['name'], active: SymbolViewProps['name']) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <SymbolView name={focused ? active : idle} tintColor={color} size={25} />
  );

export default function TabLayout() {
  const t = useTheme();
  const { pendingCount } = useWatchers();
  return (
    <Tabs
      screenOptions={{
        // Each tab draws its own large title.
        headerShown: false,
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.bg, borderTopColor: t.line, borderTopWidth: hairline },
        tabBarLabelStyle: { fontSize: 10, fontFamily: fontFor(500) },
        tabBarBadgeStyle: { backgroundColor: t.danger, color: '#ffffff', fontSize: 11, fontFamily: fontFor(600) },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Photos',
          tabBarIcon: icon(
            { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' },
            { ios: 'photo.fill.on.rectangle.fill', android: 'photo_library', web: 'photo_library' },
          ),
        }}
      />
      <Tabs.Screen
        name="watchers"
        options={{
          title: 'Watchers',
          // Watchers still waiting for their code to be entered.
          tabBarBadge: pendingCount || undefined,
          tabBarIcon: icon(
            { ios: 'eye', android: 'visibility', web: 'visibility' },
            { ios: 'eye.fill', android: 'visibility', web: 'visibility' },
          ),
        }}
      />
      <Tabs.Screen
        name="texts"
        options={{
          title: 'Texts',
          tabBarIcon: icon(
            { ios: 'message', android: 'chat', web: 'chat' },
            { ios: 'message.fill', android: 'chat', web: 'chat' },
          ),
        }}
      />
    </Tabs>
  );
}
