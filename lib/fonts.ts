// Imported weight by weight so only these five files ship with the app.
import { SchibstedGrotesk_400Regular } from '@expo-google-fonts/schibsted-grotesk/400Regular';
import { SchibstedGrotesk_500Medium } from '@expo-google-fonts/schibsted-grotesk/500Medium';
import { SchibstedGrotesk_600SemiBold } from '@expo-google-fonts/schibsted-grotesk/600SemiBold';
import { SchibstedGrotesk_700Bold } from '@expo-google-fonts/schibsted-grotesk/700Bold';
import { SchibstedGrotesk_800ExtraBold } from '@expo-google-fonts/schibsted-grotesk/800ExtraBold';

// Lookout's typeface: Schibsted Grotesk, a sans-serif drawn for a Scandinavian
// news publisher. Each weight is its own font file, so a weight is chosen by
// name rather than with fontWeight (iOS ignores fontWeight for custom fonts).

export const FONT_FILES = {
  'Lookout-Regular': SchibstedGrotesk_400Regular,
  'Lookout-Medium': SchibstedGrotesk_500Medium,
  'Lookout-SemiBold': SchibstedGrotesk_600SemiBold,
  'Lookout-Bold': SchibstedGrotesk_700Bold,
  'Lookout-ExtraBold': SchibstedGrotesk_800ExtraBold,
};

/** The font file for a CSS-style weight ("400", "600", "bold"...). */
export function fontFor(weight: string | number | undefined): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (w >= 800) return 'Lookout-ExtraBold';
  if (w >= 700) return 'Lookout-Bold';
  if (w >= 600) return 'Lookout-SemiBold';
  if (w >= 500) return 'Lookout-Medium';
  return 'Lookout-Regular';
}
