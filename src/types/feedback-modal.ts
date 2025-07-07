// Tipos para o componente FeedbackModal

// Personagens disponíveis
export type Character = "amy" | "angelita" | "graozinho"

// Tipos de tarefas
export type TaskType = "challenge" | "diary" | "goal" | "emotion"

// Props para o componente FeedbackModal
export interface FeedbackModalProps {
  visible: boolean
  onClose: () => void
  character: Character
  message: string
  points: number
  taskType?: TaskType
}

// Configuração para cada tipo de tarefa
export interface TaskTypeConfig {
  icon: string
  color: string
  confetti: any // Tipo para animação Lottie
}

// Mapeamento de tipos de tarefas para configurações
export interface TaskTypeConfigMap {
  [key: string]: TaskTypeConfig
}

// Mapeamento de personagens para imagens
export interface CharacterImageMap {
  [key: string]: any // Tipo para imagem
}
