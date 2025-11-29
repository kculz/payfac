// types/auth.ts
export interface User {
  id: string;
  email: string;
  business_name: string;
  phone: string;
  email_verified: boolean;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RegisterData {
  email: string;
  password: string;
  business_name: string;
  phone: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileData {
  business_name?: string;
  phone?: string;
}

export interface VerifyEmailData {
  token: string;
}

export interface ResendVerificationResponse {
  message: string;
  sent: boolean;
}

// Auth store state interface
export interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  login: (data: LoginData) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshTokens: () => Promise<AuthTokens>;
  getProfile: () => Promise<User>;
  updateProfile: (data: UpdateProfileData) => Promise<User>;
  changePassword: (data: ChangePasswordData) => Promise<void>;
  forgotPassword: (data: ForgotPasswordData) => Promise<void>;
  resetPassword: (data: ResetPasswordData) => Promise<void>;
  verifyEmail: (data: VerifyEmailData) => Promise<User>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}