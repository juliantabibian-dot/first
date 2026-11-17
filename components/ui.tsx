import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { hairline, type, useTheme } from '@/lib/theme';
import { Text, TextInput } from '@/components/Text';

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** primary: the one main action. ghost: a quieter second action. danger: destroys something. */
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  /** Shorter, for a button that sits beside a field. */
  compact?: boolean;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  compact,
}: ButtonProps) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.accent : t.fill;
  const fg = variant === 'primary' ? t.onAccent : variant === 'danger' ? t.danger : t.ink;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: off ? 0.4 : pressed ? 0.75 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonText, compact && styles.buttonTextCompact, { color: fg }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * One selectable row in a grouped list: a radio or checkbox mark, a title and
 * an optional explanation. Put several inside a <Group>, with <Divider> between.
 */
export function Choice({
  kind,
  selected,
  title,
  body,
  onPress,
  disabled,
  leading,
}: {
  /** Shown between the mark and the text, e.g. a watcher's face. */
  leading?: React.ReactNode;
  kind: 'radio' | 'checkbox';
  selected: boolean;
  title: string;
  body?: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityLabel={title}
      // aria-checked is what the web build reads; accessibilityState is for iOS.
      aria-checked={selected}
      accessibilityState={{ checked: selected, selected, disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.tick();
        onPress();
      }}
      style={({ pressed }) => [
        styles.choice,
        leading ? styles.choiceCentered : null,
        { opacity: pressed ? 0.6 : 1 },
      ]}>
      <View
        style={[
          styles.choiceMark,
          leading ? { marginTop: 0 } : null,
          { borderRadius: kind === 'radio' ? 11 : 6 },
          selected
            ? { backgroundColor: t.accent, borderColor: t.accent }
            : { borderColor: t.muted },
        ]}>
        {selected ? <Text style={[styles.choiceTick, { color: t.onAccent }]}>✓</Text> : null}
      </View>
      {leading}
      <View style={styles.choiceText}>
        <Text style={[type.headline, { color: t.ink }]}>{title}</Text>
        {body ? <Text style={[type.footnote, styles.choiceBody, { color: t.muted }]}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

/** A plain text action, like the ones in iOS lists. */
export function TextButton({
  title,
  onPress,
  tone = 'default',
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const color = tone === 'danger' ? t.danger : t.ink;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={off}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.textButton, { opacity: off ? 0.4 : pressed ? 0.5 : 1 }]}>
      {loading ? <ActivityIndicator color={color} size="small" /> : null}
      <Text style={[styles.textButtonText, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...input }: { label: string } & TextInputProps) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[type.footnote, styles.fieldLabel, { color: t.muted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...input}
        style={[styles.input, { backgroundColor: t.fill, color: t.ink }, input.style]}
      />
    </View>
  );
}

/** A filled block that groups related rows, like an iOS grouped list section. */
export function Group({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.group, { backgroundColor: t.fill }, style]}>{children}</View>;
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return <View style={{ height: hairline, backgroundColor: t.line, marginLeft: inset }} />;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[type.label, styles.sectionLabel, { color: t.muted }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[type.footnote, styles.message, { color: t.danger }]}>{children}</Text>;
}

/** A neutral line saying what just happened. */
export function NoteText({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={[type.footnote, styles.message, { color: t.muted }]}>{children}</Text>;
}

/** The Lookout eye. */
export function Mark({ size = 28, color }: { size?: number; color?: string }) {
  const t = useTheme();
  return (
    <Image
      source={require('../assets/images/mark.png')}
      tintColor={color ?? t.ink}
      contentFit="contain"
      style={{ width: size, height: size }}
      accessibilityLabel="Lookout"
    />
  );
}

/** Large left-aligned title at the top of a tab, with optional controls on the right. */
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerText}>
        <Text accessibilityRole="header" style={[type.largeTitle, { color: t.ink }]}>
          {title}
        </Text>
        {subtitle ? <Text style={[type.callout, { color: t.muted }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 44, borderRadius: 10, paddingHorizontal: 16 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  buttonTextCompact: { fontSize: 15 },
  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  choiceCentered: { alignItems: 'center' },
  choiceMark: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceTick: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
  choiceText: { flex: 1 },
  choiceBody: { marginTop: 2 },
  textButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  textButtonText: { fontSize: 15, fontWeight: '600' },
  field: { marginBottom: 14 },
  fieldLabel: { marginBottom: 6 },
  input: { borderRadius: 10, paddingHorizontal: 14, minHeight: 48, fontSize: 17 },
  group: { borderRadius: 12, overflow: 'hidden' },
  sectionLabel: { marginTop: 28, marginBottom: 8 },
  message: { marginBottom: 12 },
  header: {
    flexDirection: 'row',
    // Controls line up with the title, whether or not there is a subtitle under it.
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerText: { flex: 1, minWidth: 0, gap: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 3 },
});
