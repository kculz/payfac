// app/(auth)/login.tsx
import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { LoginForm } from '@/components/forms/LoginForm';
import { Screen } from '@/components/layouts/Screen';

export default function LoginScreen() {
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Sign In',
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
          <LoginForm />
        </View>
      </Screen>
    </>
  );
}