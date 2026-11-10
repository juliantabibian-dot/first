import { useColorScheme } from 'react-native';

const light = {
  bg: '#f5f5f7',
  card: '#ffffff',
  ink: '#16161d',
  muted: '#6b6b78',
  line: '#e6e6ec',
  field: '#fafafc',
  accent: '#4f46e5',
  accentSoft: '#eef0ff',
  onAccent: '#ffffff',
  warn: '#b45309',
  warnSoft: '#fff7e6',
  ok: '#047857',
  okSoft: '#e8f8f1',
  danger: '#dc2626',
  dangerSoft: '#fdecec',
};

const dark: Palette = {
  bg: '#0e0e12',
  card: '#1a1a21',
  ink: '#f2f2f6',
  muted: '#9a9aa8',
  line: '#2a2a33',
  field: '#121217',
  accent: '#818cf8',
  accentSoft: '#23244a',
  onAccent: '#0e0e12',
  warn: '#fbbf24',
  warnSoft: '#3a2c0c',
  ok: '#34d399',
  okSoft: '#0f2f25',
  danger: '#f87171',
  dangerSoft: '#3d1818',
};

export type Palette = typeof light;

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
