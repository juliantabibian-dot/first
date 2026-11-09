import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useTheme } from '@/lib/theme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const t = useTheme();
  const bg = { primary: t.accent, ghost: t.accentSoft, danger: t.dangerSoft }[variant];
  const fg = { primary: t.onAccent, ghost: t.accent, danger: t.danger }[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: t.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...input}
        style={[
          styles.input,
          { borderColor: t.line, backgroundColor: t.field, color: t.ink },
          input.style,
        ]}
      />
    </View>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.line }]}>{children}</View>
  );
}

export function ErrorText({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[styles.error, { color: t.danger }]}>{children}</Text>;
}

/** Placeholder for a tab whose feature arrives in a later milestone. */
export function EmptyState({ title, body }: { title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <Card>
        <Text style={[styles.emptyTitle, { color: t.ink }]}>{title}</Text>
        <Text style={[styles.emptyBody, { color: t.muted }]}>{body}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600' },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  error: { fontSize: 13, marginBottom: 10 },
  screen: { flex: 1, padding: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
