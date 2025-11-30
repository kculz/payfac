// components/forms/ForgotPasswordForm.tsx
import React from 'react';
import { View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'expo-router';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { useAuth } from '@/lib/hooks/useAuth';

// Validation schema
const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
  style?: any;
}

export function ForgotPasswordForm({ onSuccess, style }: ForgotPasswordFormProps) {
  const { forgotPassword, isLoading, error, clearError } = useAuth();
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState('');

  const {
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const [formData, setFormData] = React.useState<ForgotPasswordFormData>({
    email: '',
  });

  const handleInputChange = (field: keyof ForgotPasswordFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValue(field, value, { shouldValidate: true });
    
    if (error) clearError();
  };

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    try {
      clearError();
      await forgotPassword(data);
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Forgot password error:', error);
    }
  };

  if (isSubmitted) {
    return (
      <View style={style}>
        <View style={{ gap: 24 }}>
          <View style={{ gap: 8 }}>
            <Text variant="h1" align="center">
              Check Your Email
            </Text>
            <Text variant="body" color="secondary" align="center">
              We've sent password reset instructions to{'\n'}
              <Text variant="body" color="primary">
                {submittedEmail}
              </Text>
            </Text>
          </View>

          <Alert
            variant="success"
            title="Email Sent"
            description="If an account exists with this email, you'll receive password reset instructions shortly."
          />

          <View style={{ gap: 16 }}>
            <Link href="/(auth)/login" asChild>
              <Button size="lg" fullWidth>
                Back to Login
              </Button>
            </Link>

            <Text variant="caption" color="secondary" align="center">
              Didn't receive the email? Check your spam folder or{' '}
              <Text 
                variant="caption" 
                color="primary"
                onPress={() => setIsSubmitted(false)}
              >
                try again
              </Text>
            </Text>
          </View>
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
            Reset Password
          </Text>
          <Text variant="body" color="secondary" align="center">
            Enter your email to receive reset instructions
          </Text>
        </View>

        {/* Error Alert */}
        {error && (
          <Alert
            variant="error"
            title="Request Failed"
            description={error}
            dismissible
            onDismiss={clearError}
          />
        )}

        <Card>
          <View style={{ gap: 16 }}>
            {/* Email */}
            <Input
              label="Email Address"
              placeholder="Enter your email"
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email?.message}
              required
            />

            {/* Submit Button */}
            <Button
              onPress={() => handleSubmit(handleForgotPassword)()}
              loading={isLoading}
              disabled={isLoading}
              size="lg"
              fullWidth
            >
              Send Reset Instructions
            </Button>
          </View>
        </Card>

        {/* Back to Login Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text variant="body" color="secondary">
            Remember your password?
          </Text>
          <Link href="/(auth)/login" asChild>
            <Button variant="primary" size="sm">
              Back to Login
            </Button>
          </Link>
        </View>
      </View>
    </View>
  );
}