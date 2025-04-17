"use client"

import { TouchableOpacity, Text, StyleSheet } from "react-native"
import { useNotifications } from "../hooks/use-notifications"

interface TestNotificationButtonProps {
  label?: string
  style?: any
}

export function TestNotificationButton({ label = "Testar Notificação", style }: TestNotificationButtonProps) {
  const { sendTestNotification } = useNotifications()

  return (
    <TouchableOpacity style={[styles.button, style]} onPress={sendTestNotification}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#F163E0",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
})
