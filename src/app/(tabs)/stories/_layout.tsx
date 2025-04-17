import React from 'react';
import { Stack } from 'expo-router';
import { theme } from '../../../constants/theme';

export default function StoriesLayout() {
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
        name="index"
        options={{
          headerShown: false,
          title: 'Stories',
        }}
      />
      <Stack.Screen
        name="StoryPageScreen"
        options={{
          headerShown: true,
          title: 'Páginas da História',
        }}
      />
    </Stack>
  );
}