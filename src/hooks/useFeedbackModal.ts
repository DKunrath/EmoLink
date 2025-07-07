"use client"

import { useState } from "react"

// Tipos para os parâmetros do modal
type Character = "amy" | "angelita" | "graozinho"
type TaskType = "challenge" | "diary" | "goal" | "story"

interface FeedbackModalState {
  visible: boolean
  character: Character
  message: string
  points: number
  taskType: TaskType
}

// Hook personalizado para gerenciar o estado do modal de feedback
export const useFeedbackModal = () => {
  const [modalState, setModalState] = useState<FeedbackModalState>({
    visible: false,
    character: "amy",
    message: "",
    points: 0,
    taskType: "challenge",
  })

  // Função para mostrar o modal
  const showFeedbackModal = (
    character: Character,
    message: string,
    points: number,
    taskType: TaskType = "challenge",
  ) => {
    setModalState({
      visible: true,
      character,
      message,
      points,
      taskType,
    })
  }

  // Função para fechar o modal
  const hideFeedbackModal = () => {
    setModalState((prev) => ({
      ...prev,
      visible: false,
    }))
  }

  return {
    modalState,
    showFeedbackModal,
    hideFeedbackModal,
  }
}

export default useFeedbackModal
