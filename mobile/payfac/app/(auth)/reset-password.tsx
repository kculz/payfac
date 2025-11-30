// app/(auth)/reset-password.tsx
import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layouts/Screen';
import { ResetPasswordForm } from '@/components/forms/ResetPasswordForm';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  
  // Get token from URL params (from reset password email)
  const token = params.token && typeof params.token === 'string' ? params.token : '';

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Set New Password',
          headerShown: true,
          headerStyle: { backgroundColor: '#0a0a0a' },
          headerTintColor: '#ffffff',
          headerShadowVisible: false,
        }} 
      />
      
      <Screen className="flex-1 px-6 bg-dark-bg">
        <View className="flex-1 justify-center">
          <ResetPasswordForm initialToken={token} />
        </View>
      </Screen>
    </>
  );
}