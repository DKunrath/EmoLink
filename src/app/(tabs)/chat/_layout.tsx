import React from 'react';
import { Stack } from 'expo-router';
import { theme } from '../../../constants/theme';

export default function ChatLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen
        name="doctorChats"
        options={{
          headerShown: false,
          title: 'Chat',
        }}
      />
      <Stack.Screen
        name="chat"
        options={{
          headerShown: true,
          title: 'Conversa',
        }}
      />
    </Stack>
  );
}