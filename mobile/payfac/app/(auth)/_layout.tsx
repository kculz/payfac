// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useIsAuthenticated, useAuthLoading } from '@/lib/hooks/useAuth';

export default function AuthLayout() {
  const isAuthenticated = useIsAuthenticated();
  const isLoading = useAuthLoading();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // If user is authenticated and trying to access auth pages, redirect to tabs
    if (!isLoading && isAuthenticated && segments[0] === '(auth)') {
      router.replace('/(tabs)');
    }

    // If user is not authenticated and trying to access protected pages, redirect to login
    if (!isLoading && !isAuthenticated && segments[0] !== '(auth)') {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0a0a0a' },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
      <Stack.Screen name="verify-email" />
    </Stack>
  );
}