/**
 * Catppuccin Mocha Theme
 * 
 * Design tokens for use with Konva and TypeScript.
 * CSS variables are defined in styles/index.css for HTML elements.
 */

// ============================================
// Catppuccin Mocha Palette
// ============================================

export const colors = {
  // Base colors
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',

  // Surface colors
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',

  // Overlay colors
  overlay0: '#6c7086',
  overlay1: '#7f849c',
  overlay2: '#9399b2',

  // Text colors
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  subtext1: '#bac2de',

  // Accent colors
  blue: '#89b4fa',
  lavender: '#b4befe',
  sapphire: '#74c7ec',
  sky: '#89dceb',
  teal: '#94e2d5',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  peach: '#fab387',
  maroon: '#eba0ac',
  red: '#f38ba8',
  mauve: '#cba6f7',
  pink: '#f5c2e7',
  flamingo: '#f2cdcd',
  rosewater: '#f5e0dc',
} as const

// ============================================
// Semantic Tokens
// ============================================

export const theme = {
  // Backgrounds
  bg: colors.base,
  bgNode: colors.surface0,
  bgNodeHover: colors.surface1,

  // Borders
  border: colors.surface1,
  borderHover: colors.lavender,
  borderSelected: colors.sapphire,

  // Text
  text: colors.text,
  textMuted: colors.subtext0,

  // Accents
  accent: colors.blue,
  accentSecondary: colors.mauve,
  danger: colors.red,

  // Grid
  gridColor: 'rgba(69, 71, 90, 0.2)', // surface1 at 20% (user adjusted)
  gridSize: 20,
} as const

// ============================================
// Spacing Scale
// ============================================

export const spacing = {
  1: 4,
  2: 8,
  3: 16,
  4: 24,
  5: 32,
} as const

// Convenience aliases
export const space = {
  xs: spacing[1],  // 4px
  sm: spacing[2],  // 8px
  md: spacing[3],  // 16px
  lg: spacing[4],  // 24px
  xl: spacing[5],  // 32px
} as const

// ============================================
// Transitions
// ============================================

export const transitions = {
  fast: 150,    // ms
  normal: 200,  // ms
} as const

// ============================================
// Typography
// ============================================

export const typography = {
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  
  sizes: {
    ui: 11,          // UI labels
    description: 12, // Node description
    title: 14,       // Node title
  },

  lineHeight: 1.5,
} as const

// ============================================
// Node Defaults
// ============================================

export const nodeDefaults = {
  width: 220,
  height: 140,
  minWidth: 120,
  minHeight: 60,
  padding: spacing[3],      // 16px
  titleHeight: 32,
  borderRadius: 2,          // Sharp corners, minimal radius
  borderWidth: 1,
  borderWidthSelected: 2,
} as const

// ============================================
// Type Exports
// ============================================

export type Colors = typeof colors
export type Theme = typeof theme
export type Spacing = typeof spacing

