"use client";

import { useState } from "react";

// Tipos para os parâmetros do modal
type Streak = "3" | "7" | "30" | "180";

interface StreakModalProps {
  visible: boolean;
  streak: Streak;
}

// Hook personalizado para gerenciar o estado do modal de feedback
export const useStreakModal = () => {
  const [modalState, setModalState] = useState<StreakModalProps>({
    visible: false,
    streak: "3",
  });

  // Função para mostrar o modal
  const showStreakModal = (streak: Streak) => {
    setModalState({
      visible: true,
      streak,
    });
  };

  // Função para fechar o modal
  const hideStreakModal = () => {
    setModalState((prev) => ({
      ...prev,
      visible: false,
    }));
  };

  return {
    modalState,
    showStreakModal,
    hideStreakModal,
  };
};

export default useStreakModal;
