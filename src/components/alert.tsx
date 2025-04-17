"use client"

import { useEffect, useRef } from "react"
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { X } from "lucide-react-native"

export type AlertType = "success" | "error2" | "info" | "warning"

interface AlertProps {
  type: AlertType
  message: string
  description?: string
  onClose?: () => void
  duration?: number // Duration in ms, default 3000ms
  visible: boolean
}

export const Alert = ({ type, message, description, onClose, duration = 3000, visible }: AlertProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  // Define colors based on alert type
  const getColors = (): [string, string] => {
    switch (type) {
      case "success":
        return ["#4ade80", "#22c55e"] // Green gradient
      case "error2":
        return ["#f87171", "#ef4444"] // Red gradient
      case "warning":
        return ["#fbbf24", "#f59e0b"] // Yellow/Orange gradient
      case "info":
      default:
        return ["#F163E0", "#D14EC4"] // App's default pink/purple gradient
    }
  }

  // Define icon based on alert type
  const getIcon = () => {
    switch (type) {
      case "success":
        return "✅"
      case "error2":
        return "❌"
      case "warning":
        return "⚠️"
      case "info":
      default:
        return "ℹ️"
    }
  }

  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()

      // Auto hide after duration
      if (duration > 0) {
        const timer = setTimeout(() => {
          hideAlert()
        }, duration)
        return () => clearTimeout(timer)
      }
    }
  }, [visible])

  const hideAlert = () => {
    // Hide animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onClose) onClose()
    })
  }

  if (!visible) return null

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient colors={getColors()} style={styles.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{getIcon()}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{message}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={hideAlert}>
          <X size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  )
}

const { width } = Dimensions.get("window")

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1000,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  gradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    width: "100%",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  description: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
})
