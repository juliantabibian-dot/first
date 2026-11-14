import { useColorScheme } from 'react-native';

// Black and white, so the photos are the only color on screen. The one signal
// color is green, used only to mean "someone is watching".
const light = {
  bg: '#ffffff',
  /** Fill for inputs, grouped rows and quiet buttons. */
  fill: '#f2f2f4',
  ink: '#0b0b0c',
  muted: '#6e6e73',
  line: '#e2e2e6',
  /** Primary buttons: ink on the page, page color on the button. */
  accent: '#0b0b0c',
  onAccent: '#ffffff',
  watching: '#1f8a4c',
  warn: '#8a5a00',
  danger: '#d1242f',
  bubble: '#ececef',
};

const dark: Palette = {
  bg: '#000000',
  fill: '#1c1c1e',
  ink: '#ffffff',
  muted: '#98989f',
  line: '#2c2c2e',
  accent: '#ffffff',
  onAccent: '#000000',
  watching: '#30d158',
  warn: '#ffd60a',
  danger: '#ff453a',
  bubble: '#262629',
};

export type Palette = typeof light;

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Type scale. Sizes follow iOS text styles so the app sits naturally on an iPhone. */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 22 },
  callout: { fontSize: 15, lineHeight: 20 },
  footnote: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.7, textTransform: 'uppercase' },
} as const;

export const hairline = 0.5;
