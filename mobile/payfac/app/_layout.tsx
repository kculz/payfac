// app/_layout.tsx
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuthInitialization } from '@/lib/hooks/useAuth';
import { LoadingScreen } from '@/components/layouts/LoadingScreen';

export default function RootLayout() {
  const isLoading = useAuthInitialization();

  if (isLoading) {
    return <LoadingScreen title="Initializing app..." variant="full" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(modals)" />
      <Stack.Screen name="services" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}