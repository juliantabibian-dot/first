import { StyleSheet, Text, View } from 'react-native';

import { isDemo } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

/** Shown only in the demo version, which has no server behind it. */
export function DemoNotice({ children }: { children: string }) {
  const t = useTheme();
  if (!isDemo) return null;
  return (
    <View style={[styles.box, { backgroundColor: t.warnSoft }]}>
      <Text style={[styles.title, { color: t.warn }]}>Demo version</Text>
      <Text style={[styles.body, { color: t.warn }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  body: { fontSize: 14, lineHeight: 20 },
});
