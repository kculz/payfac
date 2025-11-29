// components/forms/RegisterForm.tsx
import React from 'react';
import { View, ScrollView } from 'react-native';
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
import { RegisterData } from '@/types/auth';

// Validation schema
const registerSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  /** Optional callback after successful registration */
  onSuccess?: () => void;
  /** Container style */
  style?: any;
}

export function RegisterForm({ onSuccess, style }: RegisterFormProps) {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuth();

  const {
    control: _control, // We'll use custom form handling for better performance
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      business_name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  // Form values for manual handling
  const [formData, setFormData] = React.useState<RegisterFormData>({
    business_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  // Update form data and clear errors when typing
  const handleInputChange = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValue(field, value, { shouldValidate: true });
    
    // Clear global error when user starts typing
    if (error) {
      clearError();
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    try {
      clearError();
      
      // Prepare data for API (exclude confirmPassword)
      const registerData: RegisterData = {
        business_name: data.business_name,
        email: data.email,
        phone: data.phone,
        password: data.password,
      };

      await register(registerData);
      
      // Success - redirect or call callback
      if (onSuccess) {
        onSuccess();
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      // Error is handled by the auth store
      console.error('Registration error:', error);
    }
  };

  return (
    <ScrollView 
      style={style}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      <View style={{ gap: 24 }}>
        {/* Header */}
        <View style={{ gap: 8 }}>
          <Text variant="h1" align="center">
            Create Account
          </Text>
          <Text variant="body" color="secondary" align="center">
            Join PayFac and start processing payments
          </Text>
        </View>

        {/* Error Alert */}
        {error && (
          <Alert
            variant="error"
            title="Registration Failed"
            description={error}
            dismissible
            onDismiss={clearError}
          />
        )}

        <Card>
          <View style={{ gap: 16 }}>
            {/* Business Name */}
            <Input
              label="Business Name"
              placeholder="Enter your business name"
              value={formData.business_name}
              onChangeText={(value) => handleInputChange('business_name', value)}
              autoCapitalize="words"
              autoComplete="name"
              error={errors.business_name?.message}
              required
            />

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

            {/* Phone */}
            <Input
              label="Phone Number"
              placeholder="Enter your phone number"
              value={formData.phone}
              onChangeText={(value) => handleInputChange('phone', value)}
              keyboardType="phone-pad"
              autoComplete="tel"
              error={errors.phone?.message}
              required
            />

            {/* Password */}
            <Input
              label="Password"
              placeholder="Create a strong password"
              value={formData.password}
              onChangeText={(value) => handleInputChange('password', value)}
              secureTextEntry
              showPasswordToggle
              autoComplete="password-new"
              error={errors.password?.message}
              helperText="Must be at least 8 characters with uppercase, lowercase, and number"
              required
            />

            {/* Confirm Password */}
            <Input
              label="Confirm Password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(value) => handleInputChange('confirmPassword', value)}
              secureTextEntry
              showPasswordToggle
              autoComplete="password-new"
              error={errors.confirmPassword?.message}
              required
            />

            {/* Terms and Conditions */}
            <View style={{ marginTop: 8 }}>
              <Text variant="caption" color="secondary" align="center">
                By creating an account, you agree to our{' '}
                <Text variant="caption" color="primary">
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text variant="caption" color="primary">
                  Privacy Policy
                </Text>
              </Text>
            </View>

            {/* Register Button */}
            <Button
              onPress={() => handleSubmit(handleRegister)()}
              loading={isLoading}
              disabled={isLoading}
              size="lg"
              fullWidth
              style={{ marginTop: 8 }}
            >
              Create Account
            </Button>
          </View>
        </Card>

        {/* Login Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
          <Text variant="body" color="secondary">
            Already have an account?
          </Text>
          <Link href="/(auth)/login" asChild>
            <Button variant="primary" size="sm">
              Sign In
            </Button>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}