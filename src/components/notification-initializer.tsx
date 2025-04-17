"use client"

import { useEffect } from "react"
import { useNotifications } from "../hooks/use-notifications"

// Este componente pode ser adicionado em qualquer lugar da sua árvore de componentes
// sem interferir com a navegação
export function NotificationInitializer() {
  const { isInitialized } = useNotifications()

  useEffect(() => {
    if (isInitialized) {
      console.log("Sistema de notificações inicializado com sucesso")
    }
  }, [isInitialized])

  // Este componente não renderiza nada visualmente
  return null
}
