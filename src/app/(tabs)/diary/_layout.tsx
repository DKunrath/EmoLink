import { Stack } from 'expo-router';
import { theme } from '../../../constants/theme';

export default function DiaryLayout() {
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
        }}
      />
      <Stack.Screen
        name="select"
        options={{
          title: 'Selecionar Emoção',
          headerBackTitle: "Diário",
        }}
      />
      <Stack.Screen
        name="description"
        options={{
          title: 'Descreva sua Emoção',
          headerBackTitle: "Selecionar Emoção",
        }}
      />
      <Stack.Screen
        name="intensity"
        options={{
          title: 'Intensidade da Emoção',
          headerBackTitle: "Descrição",
        }}
      />
    </Stack>
  );
} 