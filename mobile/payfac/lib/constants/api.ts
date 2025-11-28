// ============================================================================
// FILE: lib/constants/api.ts
// ============================================================================

/**
 * API configuration constants
 */

// Base URLs
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000/api/v1'
  : 'https://api.payfac.com/api/v1';

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
    CHANGE_PASSWORD: '/auth/change-password',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
  },

  // Balance
  BALANCE: {
    GET: '/balance',
    SUMMARY: '/balance/summary',
    CHECK: '/balance/check',
    HISTORY: '/balance/history',
    STATS: '/balance/stats',
  },

  // Transactions
  TRANSACTIONS: {
    LIST: '/transactions',
    GET: (id: string) => `/transactions/${id}`,
    SALE: '/transactions/sale',
    REFUND: (id: string) => `/transactions/${id}/refund`,
    RECENT: '/transactions/recent',
    STATS: '/transactions/stats',
    SEARCH: '/transactions/search',
  },

  // Deposits
  DEPOSITS: {
    LIST: '/deposits',
    CREATE: '/deposits',
    GET: (id: string) => `/deposits/${id}`,
    CANCEL: (id: string) => `/deposits/${id}`,
    STATS: '/deposits/stats',
  },

  // Payouts
  PAYOUTS: {
    LIST: '/payouts',
    CREATE: '/payouts',
    GET: (id: string) => `/payouts/${id}`,
    CANCEL: (id: string) => `/payouts/${id}`,
    STATS: '/payouts/stats',
  },
} as const;

// Request timeout
export const API_TIMEOUT = 30000; // 30 seconds

// Retry configuration
export const API_RETRY = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
} as const;
