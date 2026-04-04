import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { Theme } from './types';

// ─── Accent colour palette ───────────────────────────────────────────────────
export const ACCENT_COLORS = [
  { id: 'zinc',    label: 'Zinc',    value: '#18181B' },
  { id: 'indigo',  label: 'Indigo',  value: '#6366F1' },
  { id: 'blue',    label: 'Blue',    value: '#3B82F6' },
  { id: 'violet',  label: 'Violet',  value: '#8B5CF6' },
  { id: 'emerald', label: 'Emerald', value: '#10B981' },
  { id: 'rose',    label: 'Rose',    value: '#F43F5E' },
  { id: 'orange',  label: 'Orange',  value: '#F97316' },
  { id: 'amber',   label: 'Amber',   value: '#F59E0B' },
];

// ─── Light base tokens ────────────────────────────────────────────────────────
const LIGHT: Omit<Theme['colors'], 'primary' | 'fabBg'> = {
  background:      '#FFFFFF',
  text:            '#09090B',
  textSecondary:   '#71717A',
  primaryText:     '#FAFAFA',
  secondary:       '#F4F4F5',
  cardPrimary:     '#FFFFFF',
  cardSecondary:   '#FAFAFA',
  border:          '#E4E4E7',
  accent:          '#18181B',
  accentBg:        '#F4F4F5',
  danger:          '#EF4444',
  dangerBg:        '#FEF2F2',
  warning:         '#F97316',
  warningBg:       '#FFF7ED',
  tagWorkText:     '#6366F1',
  tagWorkBg:       '#EEF2FF',
  tagPersonalText: '#71717A',
  tagPersonalBg:   '#F4F4F5',
  tagReviewText:   '#F97316',
  tagReviewBg:     '#FFF7ED',
  heroCardBg:      '#18181B',
  heroCardText:    '#FAFAFA',
  fabText:         '#FAFAFA',
};

// ─── Dark base tokens ─────────────────────────────────────────────────────────
const DARK: Omit<Theme['colors'], 'primary' | 'fabBg'> = {
  background:      '#09090B',   // zinc-950
  text:            '#FAFAFA',   // zinc-50
  textSecondary:   '#A1A1AA',   // zinc-400
  primaryText:     '#09090B',
  secondary:       '#27272A',   // zinc-800
  cardPrimary:     '#18181B',   // zinc-900
  cardSecondary:   '#27272A',
  border:          '#3F3F46',   // zinc-700
  accent:          '#FAFAFA',
  accentBg:        '#27272A',
  danger:          '#F87171',
  dangerBg:        '#450A0A',
  warning:         '#FB923C',
  warningBg:       '#431407',
  tagWorkText:     '#818CF8',
  tagWorkBg:       '#1E1B4B',
  tagPersonalText: '#A1A1AA',
  tagPersonalBg:   '#27272A',
  tagReviewText:   '#FB923C',
  tagReviewBg:     '#431407',
  heroCardBg:      '#18181B',
  heroCardText:    '#FAFAFA',
  fabText:         '#09090B',
};

const BASE_THEME: Omit<Theme, 'colors'> = {
  spacing: { xs: 4, small: 8, medium: 16, large: 24, xlarge: 32 },
  radii:   { small: 6, medium: 8, large: 12, round: 9999 },
};

// ─── Build a full theme from mode + accent ────────────────────────────────────
function buildTheme(isDark: boolean, accentValue: string): Theme {
  const base = isDark ? DARK : LIGHT;
  return {
    ...BASE_THEME,
    colors: {
      ...base,
      primary: accentValue,
      fabBg:   accentValue,
      // In dark mode, primaryText flips to dark so text is readable on light accents
      primaryText: isDark ? '#09090B' : '#FAFAFA',
      // heroCardBg stays zinc-900 always for the inner card contrast
      heroCardBg: '#18181B',
      heroCardText: '#FAFAFA',
    },
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleDark: () => void;
  accentId: string;
  setAccent: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: buildTheme(false, '#18181B'),
  isDark: false,
  toggleDark: () => {},
  accentId: 'zinc',
  setAccent: () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDark, setIsDark]     = useState(false);
  const [accentId, setAccentId] = useState('zinc');

  const accentValue = ACCENT_COLORS.find((c) => c.id === accentId)?.value ?? '#18181B';

  const theme = useMemo(
    () => buildTheme(isDark, accentValue),
    [isDark, accentValue]
  );

  return (
    <ThemeContext.Provider value={{
      theme,
      isDark,
      toggleDark: () => setIsDark((d) => !d),
      accentId,
      setAccent: setAccentId,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
