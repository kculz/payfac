// app/(auth)/register.tsx
import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { RegisterForm } from '@/components/forms/RegisterForm';
import { Screen } from '@/components/layouts/Screen';

export default function RegisterScreen() {
  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Create Account',
          headerShown: true,
          headerStyle: {
            backgroundColor: '#0a0a0a',
          },
          headerTintColor: '#ffffff',
          headerShadowVisible: false,
        }} 
      />
      
      <Screen className="flex-1 px-6 bg-dark-bg">
        <View className="flex-1 justify-center py-8">
          <RegisterForm />
        </View>
      </Screen>
    </>
  );
}