import { supabase } from "./supabase"
import { NotificationService } from "./notification"

export class NotificationManager {
  // Flag para controlar se as notificações já foram agendadas
  private static notificationsScheduled = false

  // Carregar todas as notificações ativas do banco de dados
  static async loadActiveNotifications() {
    try {
      const { data, error } = await supabase.from("notifications").select("*").eq("active", true)

      if (error) {
        throw error
      }

      return data || []
    } catch (error) {
      return []
    }
  }

  // Agendar todas as notificações programadas
  static async scheduleAllNotifications() {
    // Verificar se as notificações já foram agendadas nesta sessão
    if (this.notificationsScheduled) {
      return true
    }

    try {
      // Primeiro, cancela todas as notificações existentes
      await NotificationService.cancelAllNotifications()

      // Carrega notificações ativas do banco de dados
      const notifications = await this.loadActiveNotifications()

      // Agenda cada notificação de acordo com seu tipo
      let scheduledCount = 0
      for (const notification of notifications) {
        await this.scheduleNotification(notification)
        scheduledCount++
      }

      // Marcar que as notificações foram agendadas
      this.notificationsScheduled = true

      return true
    } catch (error) {
      return false
    }
  }

  // Agendar uma notificação específica
  static async scheduleNotification(notification: any) {
    try {
      const notificationData = {
        title: notification.title,
        body: notification.body,
        data: {
          notificationId: notification.id,
          actionType: notification.action_type,
          actionData: notification.action_data,
          characterName: notification.character_name,
        },
      }

      switch (notification.schedule_type) {
        case "daily":
          // Extrai hora e minuto do scheduled_time (formato "HH:MM")
          const [hour, minute] = notification.scheduled_time.split(":").map(Number)
          await NotificationService.scheduleDailyNotification(notificationData, hour, minute)
          break

        case "weekly":
          if (notification.scheduled_days && notification.scheduled_time) {
            const [weeklyHour, weeklyMinute] = notification.scheduled_time.split(":").map(Number)

            // Agenda para cada dia da semana especificado
            for (const weekday of notification.scheduled_days) {
              await NotificationService.scheduleWeeklyNotification(
                notificationData,
                weekday, // 1-7 onde 1 é segunda-feira
                weeklyHour,
                weeklyMinute,
              )
            }
          }
          break

        case "one_time":
          if (notification.scheduled_date) {
            const scheduledDate = new Date(notification.scheduled_date)
            await NotificationService.scheduleNotificationForTime(notificationData, scheduledDate)
          }
          break

        case "random":
          // Notificações aleatórias são tratadas separadamente
          break

        default:
          break
      }
    } catch (error) {
      return false
    }
  }

  // Selecionar e enviar uma notificação aleatória
  static async sendRandomNotification() {
    try {
      // Busca notificações aleatórias ativas
      const { data, error } = await supabase.from("notifications").select("*").eq("type", "random").eq("active", true)

      if (error) throw error
      if (!data || data.length === 0) return false

      // Implementa seleção ponderada com base no random_weight
      const totalWeight = data.reduce((sum, notification) => sum + (notification.random_weight || 1), 0)
      let randomValue = Math.random() * totalWeight
      let selectedNotification = data[0]

      for (const notification of data) {
        const weight = notification.random_weight || 1
        randomValue -= weight
        if (randomValue <= 0) {
          selectedNotification = notification
          break
        }
      }

      // Envia a notificação selecionada
      await NotificationService.sendImmediateNotification({
        title: selectedNotification.title,
        body: selectedNotification.body,
        data: {
          notificationId: selectedNotification.id,
          actionType: selectedNotification.action_type,
          actionData: selectedNotification.action_data,
          characterName: selectedNotification.character_name,
        },
      })

      // Registra o envio no banco de dados
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await supabase.from("sent_notifications").insert({
          notification_id: selectedNotification.id,
          user_id: user.id,
          sent_at: new Date().toISOString(),
          read: false,
        })
      }

      return true
    } catch (error) {
      return false
    }
  }

  // Registrar que uma notificação foi lida
  static async markNotificationAsRead(sentNotificationId: string) {
    try {
      const { error } = await supabase
        .from("sent_notifications")
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq("id", sentNotificationId)

      if (error) throw error
      return true
    } catch (error) {
      return false
    }
  }

  // Obter histórico de notificações do usuário
  static async getUserNotificationHistory() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error("Usuário não autenticado")

      const { data, error } = await supabase
        .from("sent_notifications")
        .select(`
          id,
          sent_at,
          read,
          read_at,
          notifications (
            id,
            title,
            body,
            type,
            character_name,
            action_type,
            action_data,
            icon
          )
        `)
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      return []
    }
  }

  // Resetar o estado de agendamento (útil para testes)
  static resetScheduleState() {
    this.notificationsScheduled = false
  }
}
