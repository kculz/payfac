// components/forms/ResetPasswordForm.tsx
import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/hooks/useAuth';
import { ResetPasswordData } from '@/types/auth';

// Validation schema
const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  /** Optional token from URL params */
  initialToken?: string;
  /** Optional callback after successful reset */
  onSuccess?: () => void;
  /** Container style */
  style?: any;
}

export function ResetPasswordForm({ 
  initialToken = '', 
  onSuccess, 
  style 
}: ResetPasswordFormProps) {
  const router = useRouter();
  const { resetPassword, isLoading, error, clearError } = useAuth();
  
  const [token, setToken] = useState(initialToken);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: initialToken,
      newPassword: '',
      confirmPassword: '',
    },
  });

  const [formData, setFormData] = useState<ResetPasswordFormData>({
    token: initialToken,
    newPassword: '',
    confirmPassword: '',
  });

  // Update token when initialToken changes
  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setFormData(prev => ({ ...prev, token: initialToken }));
      setValue('token', initialToken, { shouldValidate: true });
    }
  }, [initialToken, setValue]);

  const handleInputChange = (field: keyof ResetPasswordFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValue(field, value, { shouldValidate: true });
    
    if (error) clearError();
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    try {
      clearError();
      
      const resetData: ResetPasswordData = {
        token: data.token,
        newPassword: data.newPassword,
      };

      await resetPassword(resetData);
      setIsSubmitted(true);
      
      // Call success callback or redirect
      if (onSuccess) {
        onSuccess();
      } else {
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2000);
      }
    } catch (error) {
      console.error('Reset password error:', error);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <View style={style}>
        <View style={{ gap: 24 }}>
          {/* Success Header */}
          <View style={{ gap: 8 }}>
            <Text variant="h1" align="center">
              Password Reset!
            </Text>
            <Text variant="body" color="secondary" align="center">
              Your password has been successfully reset.{'\n'}
              Redirecting you to login...
            </Text>
          </View>

          {/* Success Alert */}
          <Alert
            variant="success"
            title="Password Updated"
            description="You can now use your new password to sign in to your account."
          />

          <Card>
            <Button
              onPress={() => router.replace('/(auth)/login')}
              size="lg"
              fullWidth
            >
              Continue to Login
            </Button>
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={style}>
      <View style={{ gap: 24 }}>
        {/* Header */}
        <View style={{ gap: 8 }}>
          <Text variant="h1" align="center">
            New Password
          </Text>
          <Text variant="body" color="secondary" align="center">
            Create a new password for your account
          </Text>
        </View>

        {/* Error Alert */}
        {error && (
          <Alert
            variant="error"
            title="Reset Failed"
            description={error}
            dismissible
            onDismiss={clearError}
          />
        )}

        <Card>
          <View style={{ gap: 16 }}>
            {/* Token Input (hidden if auto-filled from URL) */}
            {!token && (
              <Input
                label="Verification Code"
                placeholder="Enter the code from your email"
                value={formData.token}
                onChangeText={(value) => handleInputChange('token', value)}
                autoCapitalize="none"
                autoComplete="off"
                error={errors.token?.message}
                helperText="Check your email for the verification code"
                required
              />
            )}

            {/* Show token info if auto-filled */}
            {token && (
              <Alert
                variant="info"
                title="Verification Code Detected"
                description="We found your verification code in the link. You can now set your new password."
              />
            )}

            {/* New Password */}
            <Input
              label="New Password"
              placeholder="Create a new password"
              value={formData.newPassword}
              onChangeText={(value) => handleInputChange('newPassword', value)}
              secureTextEntry
              showPasswordToggle
              autoComplete="password-new"
              error={errors.newPassword?.message}
              helperText="Must be at least 8 characters with uppercase, lowercase, and number"
              required
            />

            {/* Confirm Password */}
            <Input
              label="Confirm New Password"
              placeholder="Confirm your new password"
              value={formData.confirmPassword}
              onChangeText={(value) => handleInputChange('confirmPassword', value)}
              secureTextEntry
              showPasswordToggle
              autoComplete="password-new"
              error={errors.confirmPassword?.message}
              required
            />

            {/* Reset Button */}
            <Button
              onPress={() => handleSubmit(handleResetPassword)()}
              loading={isLoading}
              disabled={isLoading}
              size="lg"
              fullWidth
            >
              Reset Password
            </Button>
          </View>
        </Card>

        {/* Back to Login */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text variant="body" color="secondary">
            Remember your password?
          </Text>
          <Button 
            variant="primary" 
            size="sm"
            onPress={() => router.push('/(auth)/login')}
          >
            Back to Login
          </Button>
        </View>
      </View>
    </View>
  );
}