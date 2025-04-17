import * as Notifications from "expo-notifications"
import * as Device from "expo-device"
import { supabase } from "./supabase"

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export interface NotificationData {
  title: string
  body: string
  data?: Record<string, any>
}

export class NotificationService {
  // Register for push notifications
  static async registerForPushNotifications() {
    if (!Device.isDevice) {
      console.log("Push Notifications are not available on emulators/simulators")
      return null
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!")
        return null
      }

      // Para desenvolvimento, vamos focar apenas em notificações locais
      // e pular a parte de obter um token push
      console.log("Permissões de notificação concedidas")
      return "local-notifications-only"

      // Comentando o código de obtenção de token push que requer projectId
      // const token = await Notifications.getExpoPushTokenAsync({
      //   projectId: "seu-project-id-aqui", // Você precisaria fornecer isso
      // }).then((response) => response.data)
      //
      // await this.saveTokenToDatabase(token)
      // return token
    } catch (error) {
      console.error("Error registering for push notifications:", error)
      return null
    }
  }

  // Save the push token to the user's profile in Supabase
  static async saveTokenToDatabase(token: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        console.error("No authenticated user found")
        return
      }

      const { error } = await supabase.from("profiles").update({ push_token: token }).eq("user_id", user.id)

      if (error) {
        console.error("Error saving push token to database:", error)
      }
    } catch (error) {
      console.error("Error in saveTokenToDatabase:", error)
    }
  }

  // Schedule a local notification
  static async scheduleLocalNotification(notification: NotificationData, trigger: any = null) {
    try {
      const notificationContent = {
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: true,
      }

      // If no trigger is provided, show immediately
      const notificationTrigger = trigger || null

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: notificationTrigger,
      })
    } catch (error) {
      console.error("Error scheduling local notification:", error)
    }
  }

  // Send an immediate notification
  static async sendImmediateNotification(notification: NotificationData) {
    await this.scheduleLocalNotification(notification)
  }

  // Schedule a notification for a specific time
  static async scheduleNotificationForTime(notification: NotificationData, date: Date) {
    const trigger = date
    await this.scheduleLocalNotification(notification, trigger)
  }

  // Schedule a daily notification
  static async scheduleDailyNotification(notification: NotificationData, hour: number, minute: number) {
    const trigger = {
      hour,
      minute,
      repeats: true,
    }
    await this.scheduleLocalNotification(notification, trigger)
  }

  // Schedule a weekly notification
  static async scheduleWeeklyNotification(
    notification: NotificationData,
    weekday: number, // 1-7 where 1 is Monday
    hour: number,
    minute: number,
  ) {
    const trigger = {
      weekday,
      hour,
      minute,
      repeats: true,
    }
    await this.scheduleLocalNotification(notification, trigger)
  }

  // Cancel all scheduled notifications
  static async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync()
  }
}
