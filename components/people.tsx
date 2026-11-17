import { StyleSheet, Text, View } from 'react-native';

import { initials, personColor, useTheme } from '@/lib/theme';

/** A watcher's initials on their own color. */
export function Avatar({ name, size = 36, ring }: { name: string; size?: number; ring?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: personColor(name),
        },
        ring ? { borderWidth: Math.max(1.5, size / 14), borderColor: ring } : null,
      ]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

/**
 * Overlapping faces, for "who is watching this". Shows up to `max` and then "+N".
 * `ring` should be the color behind the stack so the overlaps read cleanly.
 */
export function AvatarStack({
  names,
  size = 22,
  max = 3,
  ring,
}: {
  names: string[];
  size?: number;
  max?: number;
  ring?: string;
}) {
  const t = useTheme();
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  const border = ring ?? t.bg;
  return (
    <View style={styles.stack}>
      {shown.map((name, index) => (
        <View key={`${name}-${index}`} style={{ marginLeft: index ? -size * 0.32 : 0 }}>
          <Avatar name={name} size={size} ring={border} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.avatar,
            styles.more,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.32,
              borderWidth: Math.max(1.5, size / 14),
              borderColor: border,
              backgroundColor: t.fill,
            },
          ]}>
          <Text style={[styles.moreText, { color: t.ink, fontSize: size * 0.36 }]}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** "Mom", "Mom and Dad", "Mom, Dad and Sam". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#ffffff', fontWeight: '600', letterSpacing: 0.3 },
  stack: { flexDirection: 'row', alignItems: 'center' },
  more: {},
  moreText: { fontWeight: '600', fontVariant: ['tabular-nums'] },
});
