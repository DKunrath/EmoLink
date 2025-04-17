import React from 'react';
import { Stack } from 'expo-router';
import { theme } from '../../../constants/theme';
import { AuthProvider } from "../../../contexts/AuthContext";

export default function ProfileLayout() {
  return (
    <AuthProvider>
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen
        name="profile"
        options={{
          headerShown: false,
          title: 'Perfil',
        }}
      />
    </Stack>
    </AuthProvider>
  );
}