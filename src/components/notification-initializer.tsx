"use client"

import { useEffect } from "react"
import { useNotifications } from "../hooks/use-notifications"

// Este componente pode ser adicionado em qualquer lugar da sua árvore de componentes
// sem interferir com a navegação
export function NotificationInitializer() {
  const { isInitialized } = useNotifications();

  useEffect(() => {
    if (isInitialized) {
      console.log("Notificações inicializadas");
    }
  }, [isInitialized]);

  return null;
}
