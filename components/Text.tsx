import {
  Text as RNText,
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';

import { fontFor } from '@/lib/fonts';

/**
 * Text in Lookout's typeface. Use this instead of react-native's Text: it
 * reads fontWeight from the style and swaps in the matching font file.
 */
export function Text(props: TextProps) {
  const flat = StyleSheet.flatten(props.style) ?? {};
  return (
    <RNText
      {...props}
      style={[props.style, { fontFamily: fontFor(flat.fontWeight), fontWeight: undefined }]}
    />
  );
}

/** A text field in Lookout's typeface. */
export function TextInput(props: TextInputProps) {
  const flat = StyleSheet.flatten(props.style) ?? {};
  return (
    <RNTextInput
      {...props}
      style={[props.style, { fontFamily: fontFor(flat.fontWeight), fontWeight: undefined }]}
    />
  );
}
