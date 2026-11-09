import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/lib/theme';

/** Shared frame for the signed-out screens: logo, title, blurb, then the form. */
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
          <View style={styles.hero}>
            <View style={[styles.logo, { backgroundColor: t.accent }]}>
              <Text style={styles.logoGlyph}>👁️</Text>
            </View>
            <Text style={[styles.title, { color: t.ink }]}>{title}</Text>
            <Text style={[styles.blurb, { color: t.muted }]}>{blurb}</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingTop: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: 24, paddingHorizontal: 8 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoGlyph: { fontSize: 32 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  blurb: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8 },
});
