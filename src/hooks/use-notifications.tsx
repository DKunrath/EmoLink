"use client"

import { useEffect, useState, useRef } from "react"
import * as Notifications from "expo-notifications"
import { NotificationService } from "../services/notification"
import { NotificationManager } from "../services/notification-manager"
import { Platform } from "react-native"

// Este hook centraliza a lógica de inicialização de notificações
// para evitar conflitos com a navegação
export function useNotifications() {
  const [isInitialized, setIsInitialized] = useState(false)
  const initializationRef = useRef(false)

  useEffect(() => {
    // Verificar se já inicializamos para evitar inicialização dupla
    if (initializationRef.current) {
      return
    }

    // Marcar que estamos inicializando
    initializationRef.current = true

    const setupNotifications = async () => {
      try {
        console.log("Iniciando configuração de notificações...")

        // 1. Registrar para notificações
        await NotificationService.registerForPushNotifications()
        console.log("Permissões de notificação registradas")

        // 2. Configurar categorias de notificação (se necessário)
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
          console.log("Categorias de notificação configuradas")
        }

        // 3. Carregar e agendar todas as notificações programadas do banco de dados
        await NotificationManager.scheduleAllNotifications()
        console.log("Notificações agendadas com sucesso")

        setIsInitialized(true)
      } catch (error) {
        console.error("Erro ao configurar notificações:", error)
        // Resetar o estado de inicialização em caso de erro
        initializationRef.current = false
      }
    }

    // Configurar listener para quando uma notificação é recebida
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notificação recebida:", notification)
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
          // router.push(data.actionData.screen, data.actionData.params)
          console.log("Navegando para:", data.actionData.screen, data.actionData.params)
        }
        break

      case "open_url":
        if (data.actionData?.url) {
          // Abrir URL
          // Linking.openURL(data.actionData.url)
          console.log("Abrindo URL:", data.actionData.url)
        }
        break

      default:
        console.log("Tipo de ação desconhecido:", data.actionType)
    }
  }

  // Método para enviar uma notificação de teste
  const sendTestNotification = async () => {
    await NotificationService.sendImmediateNotification({
      title: "Notificação de Teste",
      body: "Esta é uma notificação de teste local.",
      data: {
        actionType: "open_screen",
        actionData: { screen: "home" },
      },
    })
  }

  // Método para enviar uma notificação aleatória
  const sendRandomNotification = async () => {
    await NotificationManager.sendRandomNotification()
  }

  // Método para reagendar notificações (útil para testes)
  const rescheduleNotifications = async () => {
    // Resetar o estado de agendamento
    NotificationManager.resetScheduleState()
    // Reagendar todas as notificações
    await NotificationManager.scheduleAllNotifications()
  }

  return {
    isInitialized,
    sendTestNotification,
    sendRandomNotification,
    rescheduleNotifications,
  }
}
