// Tipos para o componente FeedbackModal

// Personagens disponíveis
export type Streak = "3" | "7" | "30" | "180"

// Props para o componente FeedbackModal
export interface StreakModalProps {
  visible: boolean
  onClose: () => void
  streak: Streak
}

// Mapeamento de personagens para imagens
export interface CharacterImageMap {
  [key: string]: any // Tipo para imagem
}
