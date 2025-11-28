// ============================================================================
// FILE: lib/constants/colors.ts
// ============================================================================

/**
 * Color palette for the PayFac mobile app
 * Dark theme optimized
 */
export const colors = {
  // Primary brand colors
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // Dark theme colors
  dark: {
    bg: '#0a0a0a',           // Main background
    surface: '#141414',       // Cards, containers
    surfaceHover: '#1a1a1a', // Hover states
    border: '#262626',        // Borders
    text: {
      primary: '#ffffff',     // Main text
      secondary: '#a3a3a3',   // Secondary text
      tertiary: '#737373',    // Tertiary text
      disabled: '#525252',    // Disabled text
    },
  },

  // Status colors
  success: {
    DEFAULT: '#10b981',
    light: '#34d399',
    dark: '#059669',
  },
  warning: {
    DEFAULT: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
  },
  error: {
    DEFAULT: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
  },
  info: {
    DEFAULT: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
  },

  // Transaction type colors
  transaction: {
    deposit: '#10b981',
    sale: '#3b82f6',
    payout: '#f59e0b',
    refund: '#ef4444',
    fee: '#8b5cf6',
    adjustment: '#6366f1',
  },

  // Service category colors
  service: {
    airtime: '#f59e0b',
    electricity: '#eab308',
    dstv: '#3b82f6',
    fees: '#8b5cf6',
    comingSoon: '#6b7280',
  },

  // Network carrier colors (Zimbabwe)
  carrier: {
    econet: '#e11d48',
    netone: '#0ea5e9',
    telecel: '#8b5cf6',
  },

  // Transparent overlays
  overlay: {
    light: 'rgba(255, 255, 255, 0.1)',
    medium: 'rgba(255, 255, 255, 0.2)',
    dark: 'rgba(0, 0, 0, 0.5)',
    darker: 'rgba(0, 0, 0, 0.7)',
  },
} as const;

// Type exports
export type ColorKey = keyof typeof colors;
export type PrimaryShade = keyof typeof colors.primary;