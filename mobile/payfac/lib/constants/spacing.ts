// ============================================================================
// FILE: lib/constants/spacing.ts
// ============================================================================

/**
 * Spacing scale for consistent margins and padding
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

// Aliases for easier use
export const space = {
  xs: spacing[1],   // 4
  sm: spacing[2],   // 8
  md: spacing[4],   // 16
  lg: spacing[6],   // 24
  xl: spacing[8],   // 32
  '2xl': spacing[12], // 48
  '3xl': spacing[16], // 64
} as const;

/**
 * Border radius scale
 */
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

/**
 * Icon sizes
 */
export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
  '2xl': 48,
} as const;

/**
 * Common dimensions
 */
export const dimensions = {
  // Button heights
  button: {
    sm: 36,
    md: 44,
    lg: 52,
  },
  // Input heights
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },
  // Header heights
  header: {
    default: 56,
    large: 96,
  },
  // Tab bar height
  tabBar: 64,
  // Card padding
  card: {
    sm: spacing[3],
    md: spacing[4],
    lg: spacing[6],
  },
  // Screen padding
  screen: {
    horizontal: spacing[4],
    vertical: spacing[6],
  },
} as const;

export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radius;