"use client"

import { TouchableOpacity, Text, StyleSheet } from "react-native"
import { useNotifications } from "../hooks/use-notifications"

interface RandomNotificationButtonProps {
  label?: string
  style?: any
}

export function RandomNotificationButton({
  label = "Enviar Notificação Aleatória",
  style,
}: RandomNotificationButtonProps) {
  const { sendRandomNotification } = useNotifications()

  return (
    <TouchableOpacity style={[styles.button, style]} onPress={sendRandomNotification}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#B03CA9",
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
