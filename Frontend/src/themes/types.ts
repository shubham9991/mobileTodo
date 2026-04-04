export interface Theme {
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    primary: string;
    primaryText: string;
    secondary: string;
    cardPrimary: string;
    cardSecondary: string;
    border: string;
    // Status & Tags
    accent: string;
    accentBg: string;
    danger: string;
    dangerBg: string;
    warning: string;
    warningBg: string;
    tagWorkText: string;
    tagWorkBg: string;
    tagPersonalText: string;
    tagPersonalBg: string;
    tagReviewText: string;
    tagReviewBg: string;
    // Special elements
    heroCardBg: string;
    heroCardText: string;
    fabBg: string;
    fabText: string;
  };
  spacing: {
    xs: number;
    small: number;
    medium: number;
    large: number;
    xlarge: number;
  };
  radii: {
    small: number;
    medium: number;
    large: number;
    round: number;
  };
}
