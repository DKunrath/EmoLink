"use client"

import { createContext, useContext, type ReactNode } from "react"
import { Alert } from "./alert"
import { useAlert } from "../hooks/use-alert"

interface AlertContextType {
  success: (message: string, description?: string, duration?: number) => void
  error2: (message: string, description?: string, duration?: number) => void
  warning: (message: string, description?: string, duration?: number) => void
  info: (message: string, description?: string, duration?: number) => void
  hideAlert: () => void
}

const AlertContext = createContext<AlertContextType | undefined>(undefined)

export const useAlertContext = () => {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error("useAlertContext must be used within an AlertProvider")
  }
  return context
}

interface AlertProviderProps {
  children: ReactNode
}

export const AlertProvider = ({ children }: AlertProviderProps) => {
  const { alert, hideAlert, success, error2, warning, info } = useAlert()

  return (
    <AlertContext.Provider value={{ success, error2, warning, info, hideAlert }}>
      {children}
      <Alert
        visible={alert.visible}
        type={alert.type}
        message={alert.message}
        description={alert.description}
        duration={alert.duration}
        onClose={hideAlert}
      />
    </AlertContext.Provider>
  )
}
