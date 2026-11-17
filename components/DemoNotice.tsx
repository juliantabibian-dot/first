import {
  StyleSheet,
  View,
} from 'react-native';

import { isDemo } from '@/lib/supabase';
import { hairline, type, useTheme } from '@/lib/theme';
import { Text } from '@/components/Text';

/** Shown only in the demo version, which has no server behind it. */
export function DemoNotice({ children }: { children: string }) {
  const t = useTheme();
  if (!isDemo) return null;
  return (
    <View style={[styles.box, { borderColor: t.line }]}>
      <Text style={[type.label, { color: t.ink }]}>Demo version</Text>
      <Text style={[type.footnote, styles.body, { color: t.muted }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: hairline * 2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24 },
  body: { marginTop: 4 },
});
