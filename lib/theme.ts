import { useColorScheme } from 'react-native';

// Black and white, so the photos carry the color. Two signal colors, each with
// one job: green means "someone is watching", orange means "something happened
// to a photo and watchers were alerted".
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
  watchingSoft: '#e3f3e9',
  alert: '#d9480f',
  alertSoft: '#fdeee6',
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
  watchingSoft: '#13301f',
  alert: '#ff7a33',
  alertSoft: '#3a1d0e',
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

/**
 * Each watcher gets a steady color from their name, like Contacts does, so the
 * same person looks the same on every screen. Muted so they never compete with photos.
 */
const PEOPLE = ['#8e6c5a', '#5b7a8c', '#6f7d4f', '#8a5c7d', '#4f7f75', '#9a7440', '#6a6a9a', '#a05a5a'];

export function personColor(name: string): string {
  let hash = 0;
  for (const ch of name.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PEOPLE[hash % PEOPLE.length];
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
