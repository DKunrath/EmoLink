"use client"

import React, { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../constants/theme';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import SplashScreen from '../components/SplashScreen';
import { AlertProvider } from "../components/alert-provider"
import { NotificationService } from "../services/notification"
import { NotificationManager } from "../services/notification-manager"
import { NotificationInitializer } from "../components/notification-initializer"
import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import * as BackgroundFetch from "expo-background-fetch"
import * as TaskManager from "expo-task-manager"
import { router } from "expo-router"

// Definir uma tarefa em background para notificações aleatórias
const RANDOM_NOTIFICATION_TASK = "RANDOM_NOTIFICATION_TASK"

// Registrar a tarefa antes de usá-la
TaskManager.defineTask(RANDOM_NOTIFICATION_TASK, async () => {
  try {
    // Enviar uma notificação aleatória
    const result = await NotificationManager.sendRandomNotification()
    return result ? BackgroundFetch.BackgroundFetchResult.NewData : BackgroundFetch.BackgroundFetchResult.NoData
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

function RootLayoutNav() {
  const { user, isLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // 1. Configurar categorias de notificação (se necessário)
        if (Platform.OS === "ios") {
          await Notifications.setNotificationCategoryAsync("reminder", [
            {
              identifier: "open",
              buttonTitle: "Abrir App",
              options: {
                opensAppToForeground: true,
              },
            },
          ])
        }
        else if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("reminder", {
            name: "Lembrete",
            importance: Notifications.AndroidImportance.HIGH,
            sound: "default",
            vibrationPattern: [0, 250, 250, 250],
            lightColor: theme.colors.primary,
          })
        }

        // 2. Configurar tarefa em background para notificações aleatórias
        await registerBackgroundTask()
      } catch (error) {
        return false
      }
    }

    const registerBackgroundTask = async () => {
      try {
        // Verificar se a tarefa já está registrada
        const isRegistered = await TaskManager.isTaskRegisteredAsync(RANDOM_NOTIFICATION_TASK)

        if (!isRegistered) {
          // Registrar a tarefa para executar periodicamente
          await BackgroundFetch.registerTaskAsync(RANDOM_NOTIFICATION_TASK, {
            minimumInterval: 3600, // Executar no mínimo a cada 1 hora (em segundos)
            stopOnTerminate: false, // Continuar executando quando o app for fechado
            startOnBoot: true, // Iniciar após o dispositivo reiniciar
          })
        }
      } catch (error) {
        return false
      }
    }

    // Configurar listener para quando uma notificação é recebida
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
    })

    // Configurar listener para quando o usuário toca em uma notificação
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data

      // Marcar a notificação como lida se tiver um ID
      if (data.sentNotificationId) {
        NotificationManager.markNotificationAsRead(data.sentNotificationId)
      }

      // Executar a ação associada à notificação
      handleNotificationAction(data)
    })

    setupNotifications()

    // Limpar listeners quando o componente for desmontado
    return () => {
      subscription.remove()
      responseSubscription.remove()
    }
  }, [])

  // Função para lidar com ações de notificação
  const handleNotificationAction = (data: any) => {
    if (!data.actionType) return

    // Implementar lógica para diferentes tipos de ação
    switch (data.actionType) {
      case "open_screen":
        if (data.actionData?.screen) {
          // Navegar para a tela especificada
          if (!user)
            router.push("/sign-in")
          else
          router.push(data.actionData.screen, data.actionData.params)
        }
        break

      case "open_url":
        if (data.actionData?.url) {
          // Abrir URL
          // Linking.openURL(data.actionData.url)
        }
        break

      default:
        break
    }
  }
  
  // Handle splash screen completion
  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  // Se estiver mostrando a splash screen, renderize-a
  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // Se estiver carregando a autenticação, mostre o indicador de carregamento
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Renderize a estrutura de navegação com base no estado de autenticação
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#fff',
        gestureEnabled: false,
      }}
    >
      {!user ? (
        // Rotas para usuários não autenticados
        <>
          <Stack.Screen
            name="sign-in"
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="sign-up"
            options={{
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          {/* Outras telas de autenticação */}
        </>
      ) : (
        // Rotas para usuários autenticados
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PaperProvider theme={theme}>
        <AlertProvider>
        <NotificationInitializer />
          <RootLayoutNav />
        </AlertProvider>
      </PaperProvider>
    </AuthProvider>
  );
}