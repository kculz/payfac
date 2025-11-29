// components/forms/LoginForm.tsx
import React from 'react';
import { View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useRouter } from 'expo-router';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { useAuth } from '@/lib/hooks/useAuth';
import { LoginData } from '@/types/auth';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  /** Optional callback after successful login */
  onSuccess?: () => void;
  /** Container style */
  style?: any;
}

export function LoginForm({ onSuccess, style }: LoginFormProps) {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuth();

  const {
    control: _control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Form values for manual handling
  const [formData, setFormData] = React.useState<LoginFormData>({
    email: '',
    password: '',
  });

  // Update form data and clear errors when typing
  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValue(field, value, { shouldValidate: true });
    
    // Clear global error when user starts typing
    if (error) {
      clearError();
    }
  };

  const handleLogin = async (data: LoginFormData) => {
    try {
      clearError();
      await login(data);
      
      // Success - redirect or call callback
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      // Error is handled by the auth store
      console.error('Login error:', error);
    }
  };

  return (
    <View style={style}>
      <View style={{ gap: 24 }}>
        {/* Header */}
        <View style={{ gap: 8 }}>
          <Text variant="h1" align="center">
            Welcome Back
          </Text>
          <Text variant="body" color="secondary" align="center">
            Sign in to your PayFac account
          </Text>
        </View>

        {/* Error Alert */}
        {error && (
          <Alert
            variant="error"
            title="Login Failed"
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

            {/* Password */}
            <Input
              label="Password"
              placeholder="Enter your password"
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry
              showPasswordToggle
              autoComplete="password"
              error={errors.password?.message}
              required
            />

            {/* Forgot Password Link */}
            <View style={{ alignItems: 'flex-end' }}>
              <Link href="/(auth)/forgot-password" asChild>
                <Button variant="primary" size="sm">
                  Forgot Password?
                </Button>
              </Link>
            </View>

            {/* Login Button */}
            <Button
              onPress={() => handleSubmit(handleLogin)()}
              loading={isLoading}
              disabled={isLoading}
              size="lg"
              fullWidth
            >
              Sign In
            </Button>
          </View>
        </Card>

        {/* Registration Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text variant="body" color="secondary">
            Don't have an account?
          </Text>
          <Link href="/(auth)/register" asChild>
            <Button variant="primary" size="sm">
              Sign Up
            </Button>
          </Link>
        </View>
      </View>
    </View>
  );
}