"use client"

import { useState, useCallback } from "react"
import type { AlertType } from "../components/alert"

interface AlertState {
  visible: boolean
  type: AlertType
  message: string
  description?: string
  duration?: number
}

const initialState: AlertState = {
  visible: false,
  type: "info",
  message: "",
  description: "",
  duration: 3000,
}

export const useAlert = () => {
  const [alert, setAlert] = useState<AlertState>(initialState)

  const showAlert = useCallback((type: AlertType, message: string, description?: string, duration = 3000) => {
    setAlert({
      visible: true,
      type,
      message,
      description,
      duration,
    })
  }, [])

  const hideAlert = useCallback(() => {
    setAlert((prev) => ({ ...prev, visible: false }))
  }, [])

  const success = useCallback(
    (message: string, description?: string, duration?: number) => {
      showAlert("success", message, description, duration)
    },
    [showAlert],
  )

  const error2 = useCallback(
    (message: string, description?: string, duration?: number) => {
      showAlert("error2", message, description, duration)
    },
    [showAlert],
  )

  const warning = useCallback(
    (message: string, description?: string, duration?: number) => {
      showAlert("warning", message, description, duration)
    },
    [showAlert],
  )

  const info = useCallback(
    (message: string, description?: string, duration?: number) => {
      showAlert("info", message, description, duration)
    },
    [showAlert],
  )

  return {
    alert,
    showAlert,
    hideAlert,
    success,
    error2,
    warning,
    info,
  }
}
