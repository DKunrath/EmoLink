"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
  Platform,
} from "react-native"
import { supabase } from "../services/supabase"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { useAuth } from "../hooks/useAuth"
import { useAlertContext } from "./alert-provider"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Picker } from "@react-native-picker/picker"
import FeedbackModal from "./FeedbackModal"
import { useFeedbackModal } from "../hooks/useFeedbackModal"
import type { Character } from "../types/feedback-modal"
import CustomPicker from "./CustomPicker"
import { updateUserPoints } from "../services/pointsService"

const EMOTIONS = {
  happy: { label: "Feliz", icon: "😊", color: "#4ADE80" },
  excited: { label: "Animado(a)", icon: "🤗", color: "#F59E0B" },
  sad: { label: "Triste", icon: "😢", color: "#60A5FA" },
  upset: { label: "Chateado(a)", icon: "😫", color: "#A78BFA" },
  angry: { label: "Bravo(a)", icon: "😠", color: "#EF4444" },
  other: { label: "Outra", icon: "🤔", color: "#6B7280" },
}

// Define timeframe options
const TIMEFRAMES = [
  { value: "weekly", label: "Semanal", days: 7 },
  { value: "biweekly", label: "Quinzenal", days: 14 },
  { value: "monthly", label: "Mensal", days: 30 },
]

// Interface for goal object
interface Goal {
  id: string
  user_id: string
  emotion_type: string
  target_count: number
  timeframe: string
  start_date: string
  end_date: string
  bonus_points: number
  progress: number
  completed: boolean
  created_at: string
}

interface WeeklyGoalsScreenProps {
  onClose?: () => void
}

const WeeklyGoalsScreen: React.FC<WeeklyGoalsScreenProps> = () => {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [newGoal, setNewGoal] = useState({
    emotion_type: "happy",
    target_count: 7,
    timeframe: "weekly",
    bonus_points: 5,
  })
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const { user } = useAuth()
  const { success, error2 } = useAlertContext()
  const { width } = Dimensions.get("window")

  const { modalState, showFeedbackModal, hideFeedbackModal } = useFeedbackModal()
  const [showCompleted, setShowCompleted] = useState(false); // false = mostrar metas não concluídas
  const filteredGoals = goals.filter((goal) => goal.completed === showCompleted); // Filtrar metas com base no estado

  // Animation values for progress bars
  const progressAnims = useRef<{ [key: string]: Animated.Value }>({})

  // Quando a criança completar uma tarefa
  const onTaskComplete = (points: number) => {
    // Lista de personagens
    const characters: Character[] = ["amy", "angelita", "graozinho"]

    // Lista de mensagens motivacionais
    const motivationalMessages = [
      "Parabéns! Você alcançou sua meta com sucesso!",
      "Fantástico! Seu esforço para concluir a meta valeu a pena!",
      "Excelente trabalho ao concluir sua meta! Você está superando seus limites!",
      "Incrível! Cada meta concluída é um passo para o seu crescimento!",
      "Você é incrível! Continue conquistando novas metas!",
    ]

    // Função para selecionar um item aleatório de uma lista
    const getRandomCharacter = (list: Character[]) => {
      return list[Math.floor(Math.random() * list.length)]
    }

    const getRandomMessage = (list: string[]) => {
      return list[Math.floor(Math.random() * list.length)]
    }

    // Selecionar personagem e mensagem aleatórios
    const randomCharacter = getRandomCharacter(characters)

    const randomMessage = getRandomMessage(motivationalMessages)

    // Mostrar o modal de feedback
    showFeedbackModal(
      randomCharacter, // personagem aleatório
      randomMessage, // mensagem motivacional aleatória
      points, // pontos ganhos
      "goal", // tipo: 'challenge' | 'diary' | 'goal' | 'story'
    )
  }

  const handleCloseModal = () => {
    hideFeedbackModal()
    //navigation.goBack()
  }

  useEffect(() => {
    if (!user) return

    let subscription: RealtimeChannel | null = null

    // Set up subscription
    const setupSubscription = async () => {
      // Unsubscribe from any existing subscription first
      if (subscription) {
        await supabase.removeChannel(subscription)
      }

      subscription = supabase
        .channel("emotion_entries_changes")
        .on(
          "postgres_changes",
          {
            event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
            schema: "public",
            table: "emotion_entries",
            filter: `user_id=eq.${user.id}`, // Filter only changes for current user
          },
          async (payload) => {
            // Update goals safely
            if (goals && goals.length > 0) {
              for (const goal of goals) {
                if (goal && goal.id) {
                  try {
                    await handleUpdateGoal(goal.id)
                  } catch (error) {
                    error2("Erro", "Falha ao atualizar meta. Tente novamente.")
                  }
                }
              }
            }
          },
        )
        .subscribe()
    }

    setupSubscription()

    // Cleanup function
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription)
      }
    }
  }, [user, goals]) // Dependencies: user and goals

  useEffect(() => {
    fetchGoals()
  }, [user])

  // Fetch goals from the database
  const fetchGoals = async () => {
    try {
      setLoading(true)
      if (!user) return

      const { data, error } = await supabase
        .from("weekly_goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      setGoals(data || [])

      // Initialize animation values for each goal
      const newProgressAnims: { [key: string]: Animated.Value } = {}
      if (data) {
        data.forEach((goal) => {
          if (goal && goal.id) {
            newProgressAnims[goal.id] = new Animated.Value(0)
          }
        })
      }
      progressAnims.current = newProgressAnims

      // Animate progress bars after a short delay
      setTimeout(() => {
        if (data) {
          data.forEach((goal) => {
            if (goal && goal.id && progressAnims.current && progressAnims.current[goal.id]) {
              const progress = goal.progress / goal.target_count
              Animated.timing(progressAnims.current[goal.id], {
                toValue: isNaN(progress) ? 0 : progress,
                duration: 1000,
                useNativeDriver: false,
              }).start()
            }
          })
        }
      }, 300)

      // Update progress for each goal
      if (data) {
        for (const goal of data) {
          if (goal && goal.id) {
            try {
              await handleUpdateGoal(goal.id)
            } catch (error) {
              error2("Erro", "Falha ao atualizar meta. Tente novamente.")
            }
          }
        }
      }
    } catch (error) {
      error2("Erro", "Não foi possível carregar as metas. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  // Create a new goal
  const handleCreateGoal = async () => {
    try {
      setSaving(true)
      if (!user) {
        error2("Erro", "Você precisa estar logado para criar metas.")
        return
      }

      // Calculate start and end dates based on timeframe
      const startDate = new Date()
      const endDate = new Date()
      const timeframeObj = TIMEFRAMES.find((t) => t.value === newGoal.timeframe)
      if (timeframeObj) {
        endDate.setDate(endDate.getDate() + timeframeObj.days)
      }

      if (newGoal.timeframe === "weekly") {
        newGoal.target_count = 7
        newGoal.bonus_points = 5
      } else if (newGoal.timeframe === "biweekly") {
        newGoal.target_count = 14
        newGoal.bonus_points = 10
      } else if (newGoal.timeframe === "monthly") {
        newGoal.target_count = 30
        newGoal.bonus_points = 15
      }

      const goalData = {
        user_id: user.id,
        emotion_type: newGoal.emotion_type,
        target_count: newGoal.target_count,
        timeframe: newGoal.timeframe,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        bonus_points: newGoal.bonus_points,
        progress: 0,
        completed: false,
      }

      const { data: goalExistsData, error: goalExistsError } = await supabase
        .from("weekly_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("emotion_type", goalData.emotion_type);

      if (goalExistsError) {
        error2("Erro", "Não foi possível verificar metas existentes. Tente novamente.");
        return;
      }

      // Verificar se existe alguma meta com `completed: false`
      const hasIncompleteGoal = goalExistsData?.some((goal) => goal.completed === false);

      if (hasIncompleteGoal) {
        error2(
          "Erro",
          `Você já tem uma meta para a emoção de ${EMOTIONS[goalData.emotion_type as keyof typeof EMOTIONS]?.label || goalData.emotion_type} que ainda não foi concluída.`
        );
        // Reset form e fechar modal
        setNewGoal({
          emotion_type: "happy",
          target_count: 7,
          timeframe: "weekly",
          bonus_points: 5,
        });
        setCreateModalVisible(false);
        return;
      }

      const { data, error } = await supabase.from("weekly_goals").insert(goalData).select()

      if (error) {
        error2("Erro", "Não foi possível criar a meta. Tente novamente.");
        return;
      }

      // Reset form and close modal
      setNewGoal({
        emotion_type: "happy",
        target_count: 7,
        timeframe: "weekly",
        bonus_points: 5,
      })
      setCreateModalVisible(false)

      // Add new goal to state
      if (data && data.length > 0) {
        const newGoalData = data[0]
        setGoals((prevGoals) => [newGoalData, ...prevGoals])

        // Atualizar progresso da nova meta
        await handleUpdateGoal(newGoalData.id)

        // Initialize and animate progress bar for new goal
        progressAnims.current[newGoalData.id] = new Animated.Value(0)
        setTimeout(() => {
          Animated.timing(progressAnims.current[newGoalData.id], {
            toValue: newGoalData.progress / newGoalData.target_count,
            duration: 1000,
            useNativeDriver: false,
          }).start()
        }, 300)
      }

      success("Sucesso", "Meta criada com sucesso!")
    } catch (error) {
      error2("Erro", "Não foi possível criar a meta. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  // Delete a goal
  const handleDeleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase.from("weekly_goals").delete().eq("id", goalId)

      if (error) throw error

      // Remove goal from state
      setGoals((prevGoals) => prevGoals.filter((goal) => goal.id !== goalId))
      success("Sucesso", "Meta excluída com sucesso!")
    } catch (error) {
      error2("Erro", "Não foi possível excluir a meta. Tente novamente.")
    }
  }

  const handleUpdateGoal = async (goalId: string) => {
    if (!user || !goalId) return

    try {
      // Get the goal data
      const { data, error } = await supabase.from("weekly_goals").select("*").eq("id", goalId).single()

      if (error) throw error
      if (!data) return

      // Get emotion entries for this goal
      const { data: goalData, error: goalError } = await supabase
        .from("emotion_entries")
        .select("*")
        .eq("user_id", user.id)
        .eq("emotion_type", data.emotion_type)
        .gte("created_at", data.start_date)
        .lte("created_at", data.end_date)

      if (goalError) throw goalError

      const progress = goalData ? goalData.length : 0
      const completed = progress >= data.target_count

      // Update the goal in the database
      const updatedGoal = {
        ...data,
        progress,
        completed,
      }

      const { error: updateError } = await supabase.from("weekly_goals").update(updatedGoal).eq("id", goalId)

      if (updateError) throw updateError

      // Update the local state safely
      setGoals((prevGoals) => {
        const updatedGoals = prevGoals.map((g) => (g.id === goalId ? { ...g, progress, completed } : g))

        // Safely animate the progress bar if it exists
        const updatedGoal = updatedGoals.find((g) => g.id === goalId)
        if (updatedGoal && progressAnims.current && progressAnims.current[goalId]) {
          Animated.timing(progressAnims.current[goalId], {
            toValue: updatedGoal.progress / updatedGoal.target_count,
            duration: 1000,
            useNativeDriver: false,
          }).start()
        }

        return updatedGoals
      })

      // If goal was just completed, award bonus points
      if (completed && !data.completed) {
        // Update user points in the database
        const { data: profileData } = await supabase.from("profiles").select("points").eq("user_id", user.id).single()

        if (profileData) {
          const currentPoints = profileData.points || 0
          const newPoints = currentPoints + data.bonus_points

          updateUserPoints(user.id, data.bonus_points, "goal_completed", "Meta semanal completada")
          onTaskComplete(data.bonus_points)
        }
      }
    } catch (error) {
      error2("Erro", "Não foi possível atualizar a meta. Tente novamente.")
    }
  }

  // Format date to display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  // Get remaining days for a goal
  const getRemainingDays = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 0
  }

  // Get timeframe label
  const getTimeframeLabel = (timeframe: string) => {
    const found = TIMEFRAMES.find((t) => t.value === timeframe)
    return found ? found.label : timeframe
  }

  // Render goal item
  const renderGoalItem = (goal: Goal) => {
    const emotion = EMOTIONS[goal.emotion_type as keyof typeof EMOTIONS] || EMOTIONS.happy
    const progress = goal.progress / goal.target_count
    const remainingDays = getRemainingDays(goal.end_date)
    const isExpired = remainingDays === 0
    const isCompleted = goal.completed

    return (
      <View
        key={goal.id}
        style={[
          styles.goalCard,
          isCompleted && styles.completedGoalCard,
          isExpired && !isCompleted && styles.expiredGoalCard,
        ]}
      >
        <View style={styles.goalHeader}>
          <View style={[styles.emotionIconContainer, { backgroundColor: emotion.color }]}>
            <Text>{emotion.icon}</Text>
          </View>
          <View style={styles.goalTitleContainer}>
            <Text style={styles.goalTitle}>
              {goal.target_count} registros de {emotion.label}
            </Text>
            <Text style={styles.goalSubtitle}>{getTimeframeLabel(goal.timeframe)}</Text>
          </View>
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteGoal(goal.id)}>
            <MaterialCommunityIcons name="delete-outline" size={20} color="#FF6347" style={styles.deleteIcon} />
          </TouchableOpacity>
        </View>

        <View style={styles.goalDetails}>
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnims.current[goal.id]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: isCompleted ? "#10B981" : isExpired ? "#9CA3AF" : emotion.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
            {Math.min(goal.progress, goal.target_count)} de {goal.target_count} ({Math.round((Math.min(goal.progress, goal.target_count) / goal.target_count) * 100)}%)
            </Text>
          </View>

          <View style={styles.goalInfoRow}>
            <View style={styles.goalInfoItem}>
              <Text style={styles.goalInfoLabel}>Início:</Text>
              <Text style={styles.goalInfoValue}>{formatDate(goal.start_date)}</Text>
            </View>
            <View style={styles.goalInfoItem}>
              <Text style={styles.goalInfoLabel}>Término:</Text>
              <Text style={styles.goalInfoValue}>{formatDate(goal.end_date)}</Text>
            </View>
            <View style={styles.goalInfoItem}>
              <Text style={styles.goalInfoLabel}>Dias restantes:</Text>
              <Text
                style={[styles.goalInfoValue, isExpired && styles.expiredText, isCompleted && styles.completedText]}
              >
                {isCompleted ? "Concluído" : isExpired ? "Expirado" : remainingDays}
              </Text>
            </View>
          </View>

          <View style={styles.bonusContainer}>
            <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
            <Text style={styles.bonusText}>{goal.bonus_points} pontos de bônus</Text>
          </View>
        </View>

        {isCompleted && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>Concluído</Text>
          </View>
        )}
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Metas Semanais</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.createButton} onPress={() => setCreateModalVisible(true)} disabled={loading}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Criar Nova Meta</Text>
        </TouchableOpacity>

        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              !showCompleted && styles.filterButtonActive, // Estilo ativo para metas não concluídas
            ]}
            onPress={() => setShowCompleted(false)}
          >
            <Text
              style={[
                styles.filterButtonText,
                !showCompleted && styles.filterButtonTextActive, // Texto ativo para metas não concluídas
              ]}
            >
              Metas Não Concluídas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              showCompleted && styles.filterButtonActive, // Estilo ativo para metas concluídas
            ]}
            onPress={() => setShowCompleted(true)}
          >
            <Text
              style={[
                styles.filterButtonText,
                showCompleted && styles.filterButtonTextActive, // Texto ativo para metas concluídas
              ]}
            >
              Metas Concluídas
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F163E0" />
            <Text style={styles.loadingText}>Carregando metas...</Text>
          </View>
        ) : goals.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="target" size={64} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Nenhuma meta encontrada</Text>
            <Text style={styles.emptySubtitle}>
              Crie metas para acompanhar o progresso emocional e ganhar pontos bônus!
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.goalsList}
            contentContainerStyle={styles.goalsListContent}
            showsVerticalScrollIndicator={false}
          >
            {filteredGoals.map(renderGoalItem)}
          </ScrollView>
        )}
      </View>

      {/* Create Goal Modal */}
      <Modal
        visible={createModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Criar Nova Meta</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Emoção</Text>
              {Platform.OS === "web" ? (
                <View style={styles.selectContainer}>
                  <select
                    value={newGoal.emotion_type}
                    onChange={(e) => setNewGoal({ ...newGoal, emotion_type: e.target.value })}
                    style={styles.webSelect as any}
                  >
                    {Object.entries(EMOTIONS).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                </View>
              ) : (
                <View style={styles.pickerContainer}>
                  <CustomPicker
                    options={Object.entries(EMOTIONS).map(([key, value]) => ({
                      label: value.label,
                      value: key,
                    }))}
                    selectedValue={newGoal.emotion_type}
                    onValueChange={(itemValue: string) => setNewGoal({ ...newGoal, emotion_type: itemValue })}
                  />
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Período</Text>
              {Platform.OS === "web" ? (
                <View style={styles.selectContainer}>
                  <select
                    value={newGoal.timeframe}
                    onChange={(e) => {
                      const timeframe = e.target.value
                      let target_count = 7
                      let bonus_points = 5

                      if (timeframe === "weekly") {
                        target_count = 7
                        bonus_points = 5
                      } else if (timeframe === "biweekly") {
                        target_count = 14
                        bonus_points = 10
                      } else if (timeframe === "monthly") {
                        target_count = 30
                        bonus_points = 15
                      }

                      setNewGoal({ ...newGoal, timeframe, target_count, bonus_points })
                    }}
                    style={styles.webSelect as any}
                  >
                    {TIMEFRAMES.map((timeframe) => (
                      <option key={timeframe.value} value={timeframe.value}>
                        {timeframe.label} ({timeframe.days} dias)
                      </option>
                    ))}
                  </select>
                </View>
              ) : (
                <View style={styles.pickerContainer}>
                  <CustomPicker
                    options={TIMEFRAMES.map((timeframe) => ({
                      label: `${timeframe.label} (${timeframe.days} dias)`,
                      value: timeframe.value,
                    }))}
                    selectedValue={newGoal.timeframe}
                    onValueChange={(timeframe: string) => {
                      let target_count = 7;
                      let bonus_points = 5;

                      if (timeframe === "weekly") {
                        target_count = 7;
                        bonus_points = 5;
                      } else if (timeframe === "biweekly") {
                        target_count = 14;
                        bonus_points = 10;
                      } else if (timeframe === "monthly") {
                        target_count = 30;
                        bonus_points = 15;
                      }

                      setNewGoal({ ...newGoal, timeframe, target_count, bonus_points });
                    }}
                  />
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Quantidade de Registros</Text>
              <TextInput
                style={styles.input}
                value={newGoal.target_count.toString()}
                onChangeText={(text) => {
                  const value = Number.parseInt(text) || 0
                  setNewGoal({ ...newGoal, target_count: value })
                }}
                keyboardType="numeric"
                placeholder="Número de registros necessários"
                placeholderTextColor="#9CA3AF"
                editable={false}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Pontos de Bônus</Text>
              <TextInput
                style={styles.input}
                value={newGoal.bonus_points.toString()}
                onChangeText={(text) => {
                  const value = Number.parseInt(text) || 0
                  setNewGoal({ ...newGoal, bonus_points: value })
                }}
                keyboardType="numeric"
                placeholder="Pontos ganhos ao completar"
                placeholderTextColor="#9CA3AF"
                editable={false}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setCreateModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleCreateGoal}
                disabled={saving || newGoal.target_count <= 0}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Criar Meta</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Modal de Feedback */}
      <FeedbackModal
        visible={modalState.visible}
        onClose={handleCloseModal}
        character={modalState.character}
        message={modalState.message}
        points={modalState.points}
        taskType={modalState.taskType}
      />
    </SafeAreaView>
  )
}

const { width } = Dimensions.get("window")

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    width: width - 1, // Ajuste para centralizar o título
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#F163E0",
    borderRadius: 8,
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F163E0",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#F163E0",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  goalsList: {
    flex: 1,
  },
  goalsListContent: {
    paddingBottom: 20,
  },
  goalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    position: "relative",
  },
  completedGoalCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  expiredGoalCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#9CA3AF",
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  emotionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  goalTitleContainer: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  goalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  deleteButton: {
    padding: 4,
  },
  goalDetails: {
    marginTop: 8,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
  },
  goalInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  goalInfoItem: {
    flex: 1,
  },
  goalInfoLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  goalInfoValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },
  expiredText: {
    color: "#9CA3AF",
  },
  completedText: {
    color: "#10B981",
  },
  bonusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  bonusText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginLeft: 4,
  },
  completedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#10B981",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
    textAlign: "center",
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
  },
  pickerContainer: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
  },
  picker: {
    width: "100%",
    height: 50,
  },
  selectContainer: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
  },
  webSelect: {
    width: "100%",
    height: 50,
    padding: 12,
    fontSize: 16,
    color: "#111827",
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginRight: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F163E0",
    borderRadius: 8,
    marginLeft: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#F8BBF0",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  deleteIcon: {
    marginTop: 8,
    paddingTop: 4,
  },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  
  filterButtonActive: {
    backgroundColor: "#F163E0",
  },
  
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
})

export default WeeklyGoalsScreen
