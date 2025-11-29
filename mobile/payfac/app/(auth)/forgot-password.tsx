// app/(auth)/forgot-password.tsx
import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { ForgotPasswordForm } from '@/components/forms/ForgotPasswordForm';
import { Screen } from '@/components/layouts/Screen';

export default function ForgotPasswordScreen() {
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Reset Password',
          headerShown: true,
          headerStyle: {
            backgroundColor: '#0a0a0a',
          },
          headerTintColor: '#ffffff',
          headerShadowVisible: false,
        }} 
      />
      
      <Screen className="flex-1 px-6 bg-dark-bg">
        <View className="flex-1 justify-center">
          <ForgotPasswordForm />
        </View>
      </Screen>
    </>
  );
}