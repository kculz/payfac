// lib/store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { apiClient, tokenManager, ApiError, apiRequest } from '@/lib/api/client';
import { 
  User, 
  AuthTokens, 
  LoginResponse, 
  RegisterData, 
  LoginData, 
  ForgotPasswordData, 
  ResetPasswordData, 
  ChangePasswordData, 
  UpdateProfileData, 
  VerifyEmailData,
  AuthState 
} from '@/types/auth';

// Custom storage for SecureStore
const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch (error) {
      console.error('Error reading from secure storage:', error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (error) {
      console.error('Error writing to secure storage:', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      console.error('Error removing from secure storage:', error);
    }
  },
};

// Store creator function for better organization
const createAuthStore = () => 
  create<AuthState>()(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        tokens: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        // Initialize auth state from storage
        initialize: async () => {
          try {
            set({ isLoading: true, error: null });

            const accessToken = await tokenManager.getAccessToken();
            
            if (accessToken) {
              // Verify token is still valid by fetching profile
              await get().getProfile();
              set({ isAuthenticated: true });
            } else {
              set({ isAuthenticated: false, user: null, tokens: null });
            }
          } catch (error) {
            console.error('Auth initialization error:', error);
            // Clear invalid tokens
            await tokenManager.clearTokens();
            set({ 
              isAuthenticated: false, 
              user: null, 
              tokens: null,
              error: 'Session expired. Please login again.' 
            });
          } finally {
            set({ isLoading: false });
          }
        },

        // Register new user
        register: async (data: RegisterData) => {
          try {
            set({ isLoading: true, error: null });

            const response = await apiRequest<LoginResponse>(() =>
              apiClient.post('/auth/register', data)
            );

            // Set tokens and user data
            await tokenManager.setTokens(
              response.tokens.accessToken,
              response.tokens.refreshToken
            );

            set({
              user: response.user,
              tokens: response.tokens,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            const apiError = error as ApiError;
            set({ 
              error: apiError.message, 
              isLoading: false 
            });
            throw error;
          }
        },

        // Login user
        login: async (data: LoginData) => {
          try {
            set({ isLoading: true, error: null });

            const response = await apiRequest<LoginResponse>(() =>
              apiClient.post('/auth/login', data)
            );

            // Set tokens and user data
            await tokenManager.setTokens(
              response.tokens.accessToken,
              response.tokens.refreshToken
            );

            set({
              user: response.user,
              tokens: response.tokens,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            const apiError = error as ApiError;
            set({ 
              error: apiError.message, 
              isLoading: false 
            });
            throw error;
          }
        },

        // Logout user
        logout: async () => {
          try {
            set({ isLoading: true, error: null });

            const { tokens } = get();
            
            if (tokens?.refreshToken) {
              // Call logout endpoint to invalidate refresh token
              await apiRequest(() =>
                apiClient.post('/auth/logout', {
                  refreshToken: tokens.refreshToken,
                })
              );
            }
          } catch (error) {
            console.error('Logout API error:', error);
            // Continue with local logout even if API call fails
          } finally {
            // Always clear local state
            await tokenManager.clearTokens();
            set({
              user: null,
              tokens: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        },

        // Logout from all devices
        logoutAll: async () => {
          try {
            set({ isLoading: true, error: null });

            await apiRequest(() =>
              apiClient.post('/auth/logout-all')
            );
          } catch (error) {
            console.error('Logout all error:', error);
            // Continue with local logout even if API call fails
          } finally {
            // Always clear local state
            await tokenManager.clearTokens();
            set({
              user: null,
              tokens: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        },

        // Refresh tokens
        refreshTokens: async () => {
          try {
            const { tokens } = get();
            
            if (!tokens?.refreshToken) {
              throw new Error('No refresh token available');
            }

            const response = await apiRequest<AuthTokens>(() =>
              apiClient.post('/auth/refresh', {
                refreshToken: tokens.refreshToken,
              })
            );

            // Update tokens
            await tokenManager.setTokens(
              response.accessToken,
              response.refreshToken
            );

            set({
              tokens: response,
            });

            return response;
          } catch (error) {
            // If refresh fails, logout user
            await get().logout();
            throw error;
          }
        },

        // Get user profile
        getProfile: async () => {
          try {
            const response = await apiRequest<User>(() =>
              apiClient.get('/auth/profile')
            );

            set({
              user: response,
            });

            return response;
          } catch (error) {
            const apiError = error as ApiError;
            
            // If unauthorized, clear auth state
            if (apiError.statusCode === 401) {
              await get().logout();
            }
            
            throw error;
          }
        },

        // Update user profile
        updateProfile: async (data: UpdateProfileData) => {
          try {
            set({ isLoading: true, error: null });

            const response = await apiRequest<User>(() =>
              apiClient.put('/auth/profile', data)
            );

            set({
              user: response,
              isLoading: false,
            });

            return response;
          } catch (error) {
            const apiError = error as ApiError;
            set({ 
              error: apiError.message, 
              isLoading: false 
            });
            throw error;
          }
        },

        // Change password
        changePassword: async (data: ChangePasswordData) => {
          try {
            set({ isLoading: true, error: null });

            await apiRequest(() =>
              apiClient.post('/auth/change-password', data)
            );

            set({ isLoading: false });

            // Password changed successfully, logout user as per backend response
            await get().logout();
          } catch (error) {
            const apiError = error as ApiError;
            set({ 
              error: apiError.message, 
              isLoading: false 
            });
            throw error;
          }
        },

        // Forgot password
        forgotPassword: async (data: ForgotPasswordData) => {
          try {
            set({ isLoading: true, error: null });

            await apiRequest(() =>
              apiClient.post('/auth/forgot-password', data)
            );

            set({ isLoading: false });
          } catch (error) {
            const apiError = error as ApiError;
            set({ 
              error: apiError.message, 
              isLoading: false 
            });
            throw error;
          }
        },

        // Reset password
        resetPassword: async (data: ResetPasswordData) => {
          try {
            set({ isLoading: true, error: null });

            await apiRequest(() =>
              apiClient.post('/auth/reset-password', data)
            );

            set({ isLoading: false });
          } catch (error) {
            const apiError = error as ApiError;
            set({ 
              error: apiError.message, 
              isLoading: false 
            });
            throw error;
          }
        },

        // Verify email
        verifyEmail: async (data: VerifyEmailData) => {
          try {
            set({ isLoading: true, error: null });

            const response = await apiRequest<User>(() =>
              apiClient.post('/auth/verify-email', data)
            );

            set({
              user: response,
              isLoading: false,
            });

            return response;
          } catch (error) {
            const apiError = error as ApiError;
            set({ 
              error: apiError.message, 
              isLoading: false 
            });
            throw error;
          }
        },

        // Clear error
        clearError: () => {
          set({ error: null });
        },

        // Set loading state
        setLoading: (loading: boolean) => {
          set({ isLoading: loading });
        },
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => secureStorage),
        // Only persist these fields
        partialize: (state) => 
          Object.fromEntries(
            Object.entries(state).filter(([key]) => 
              ['user', 'tokens', 'isAuthenticated'].includes(key)
            )
          ),
      }
    )
  );

// Create the store instance
export const authStore = createAuthStore();