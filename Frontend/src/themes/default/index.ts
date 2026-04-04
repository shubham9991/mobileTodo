/**
 * Zinc/Shadcn-inspired default theme
 * Palette reference: Shadcn Zinc
 */
import { Theme } from '../types';

export const defaultTheme: Theme = {
  colors: {
    // Base
    background: '#FFFFFF',
    text: '#09090B',           // zinc-950
    textSecondary: '#71717A',  // zinc-500
    primary: '#18181B',        // zinc-900
    primaryText: '#FAFAFA',    // zinc-50
    secondary: '#F4F4F5',      // zinc-100
    cardPrimary: '#FFFFFF',
    cardSecondary: '#FAFAFA',  // zinc-50
    border: '#E4E4E7',         // zinc-200

    // Status
    accent: '#18181B',         // zinc-900 (active tab / day)
    accentBg: '#F4F4F5',
    danger: '#EF4444',         // red-500
    dangerBg: '#FEF2F2',       // red-50
    warning: '#F97316',        // orange-500
    warningBg: '#FFF7ED',      // orange-50

    // Tags
    tagWorkText: '#6366F1',    // indigo-500
    tagWorkBg: '#EEF2FF',      // indigo-50
    tagPersonalText: '#71717A',
    tagPersonalBg: '#F4F4F5',
    tagReviewText: '#F97316',
    tagReviewBg: '#FFF7ED',

    // Special elements
    heroCardBg: '#18181B',     // zinc-900
    heroCardText: '#FAFAFA',
    fabBg: '#18181B',
    fabText: '#FAFAFA',
  },
  spacing: {
    xs: 4,
    small: 8,
    medium: 16,
    large: 24,
    xlarge: 32,
  },
  radii: {
    small: 6,
    medium: 8,
    large: 12,
    round: 9999,
  },
};
