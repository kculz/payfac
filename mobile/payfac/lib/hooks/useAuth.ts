// lib/hooks/useAuth.ts
import { useCallback, useEffect } from 'react';
import { authStore } from '@/lib/store/authStore';
import { 
  RegisterData, 
  LoginData, 
  ForgotPasswordData, 
  ResetPasswordData, 
  ChangePasswordData, 
  UpdateProfileData, 
  VerifyEmailData 
} from '@/types/auth';

/**
 * Main auth hook that provides auth state and actions
 */
export const useAuth = () => {
  const state = authStore();
  
  // Memoized actions for better performance
  const register = useCallback((data: RegisterData) => 
    state.register(data), [state.register]);
  
  const login = useCallback((data: LoginData) => 
    state.login(data), [state.login]);
  
  const logout = useCallback(() => 
    state.logout(), [state.logout]);
  
  const logoutAll = useCallback(() => 
    state.logoutAll(), [state.logoutAll]);
  
  const refreshTokens = useCallback(() => 
    state.refreshTokens(), [state.refreshTokens]);
  
  const getProfile = useCallback(() => 
    state.getProfile(), [state.getProfile]);
  
  const updateProfile = useCallback((data: UpdateProfileData) => 
    state.updateProfile(data), [state.updateProfile]);
  
  const changePassword = useCallback((data: ChangePasswordData) => 
    state.changePassword(data), [state.changePassword]);
  
  const forgotPassword = useCallback((data: ForgotPasswordData) => 
    state.forgotPassword(data), [state.forgotPassword]);
  
  const resetPassword = useCallback((data: ResetPasswordData) => 
    state.resetPassword(data), [state.resetPassword]);
  
  const verifyEmail = useCallback((data: VerifyEmailData) => 
    state.verifyEmail(data), [state.verifyEmail]);
  
  const clearError = useCallback(() => 
    state.clearError(), [state.clearError]);
  
  const setLoading = useCallback((loading: boolean) => 
    state.setLoading(loading), [state.setLoading]);

  return {
    // State
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    tokens: state.tokens,
    
    // Actions
    initialize: state.initialize,
    register,
    login,
    logout,
    logoutAll,
    refreshTokens,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    clearError,
    setLoading,
  };
};

/**
 * Hook for initializing auth state on app start
 */
export const useAuthInitialization = () => {
  const { initialize, isLoading } = useAuth();
  
  useEffect(() => {
    initialize();
  }, [initialize]);
  
  return isLoading;
};

/**
 * Hook for checking if user is authenticated
 */
export const useIsAuthenticated = () => {
  return authStore((state) => state.isAuthenticated);
};

/**
 * Hook for accessing current user
 */
export const useCurrentUser = () => {
  return authStore((state) => state.user);
};

/**
 * Hook for auth loading state
 */
export const useAuthLoading = () => {
  return authStore((state) => state.isLoading);
};

/**
 * Hook for auth errors
 */
export const useAuthError = () => {
  return authStore((state) => state.error);
};

/**
 * Hook for specific auth actions without full state
 */
export const useAuthActions = () => {
  const { 
    login, 
    register, 
    logout, 
    refreshTokens, 
    getProfile, 
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    clearError 
  } = useAuth();

  return {
    login,
    register,
    logout,
    refreshTokens,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    clearError,
  };
};