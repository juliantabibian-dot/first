import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mark } from '@/components/ui';
import { type, useTheme } from '@/lib/theme';
import { Text } from '@/components/Text';

/** Shared frame for the signed-out screens: the mark, a title, one line of copy, then the form. */
export function AuthScreen({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Mark size={44} />
          <Text accessibilityRole="header" style={[type.largeTitle, styles.title, { color: t.ink }]}>
            {title}
          </Text>
          <Text style={[type.body, styles.blurb, { color: t.muted }]}>{blurb}</Text>
          <View>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 24, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { marginTop: 20 },
  blurb: { marginTop: 8, marginBottom: 32 },
});
