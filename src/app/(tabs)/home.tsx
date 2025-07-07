"use client"

import { useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  SafeAreaView,
  Dimensions,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native"
import { router } from "expo-router"
import { supabase } from "../../services/supabase"
import { useAuth } from "../../hooks/useAuth"
import { LinearGradient } from "expo-linear-gradient"
import StreakModal from "../../components/StreakModal"
import { useStreakModal } from "../../hooks/useStreakModal"
import type { Streak } from "../../types/streak-modal"

// Componente para o indicador de streak
const StreakIndicator = ({ count }: { count: number }) => {
  return (
    <View style={styles.streakContainer}>
      <LinearGradient
        colors={["#F163E0", "#D14EC4"]}
        style={styles.streakGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.streakIconContainer}>
          <Text style={styles.streakIcon}>🔥</Text>
        </View>
        <View style={styles.streakTextContainer}>
          <Text style={styles.streakCount}>{count}</Text>
          <Text style={styles.streakLabel}>dias seguidos</Text>
        </View>
      </LinearGradient>
    </View>
  )
}

// Componente para o card de estatísticas
const StatsCard = ({
  moodCount,
  points,
  isLoading,
}: {
  moodCount: number
  points: number
  isLoading: boolean
}) => {
  return (
    <View style={styles.statsCard}>
      {isLoading ? (
        <ActivityIndicator size="small" color="#F163E0" />
      ) : (
        <View style={styles.statsContent}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{moodCount}</Text>
            <Text style={styles.statLabel}>Registros</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{points}</Text>
            <Text style={styles.statLabel}>Pontos</Text>
          </View>
        </View>
      )}
    </View>
  )
}

export default function HomeScreen() {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  // Estados para dados do usuário
  const [userName, setUserName] = useState<string>("")
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [streakCount, setStreakCount] = useState<number>(0)
  const [moodCount, setMoodCount] = useState<number>(0)
  const [points, setPoints] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)

  const { modalState, showStreakModal, hideStreakModal } = useStreakModal()

  const { user } = useAuth()

  // Quando a criança completar uma tarefa
  const onCheckComplete = (streak: number) => {
    // Lista de personagens
    const streaks: Streak[] = ["3", "7", "30", "180"]

    if (streak === 3) {
      // Mostrar o modal de feedback
      showStreakModal(
        "3", // personagem aleatório
      )
    } else if (streak === 7) {
      // Mostrar o modal de feedback
      showStreakModal(
        "7", // personagem aleatório
      )
    } else if (streak === 30) {
      // Mostrar o modal de feedback
      showStreakModal(
        "30", // personagem aleatório
      )
    } else if (streak === 180) {
      // Mostrar o modal de feedback
      showStreakModal(
        "180", // personagem aleatório
      )
    }
  }

  const handleCloseModal = () => {
    hideStreakModal()
  }

  useEffect(() => {
    if (user) {
      loadUserData().then(() => {
        calculateStreak().then(() => {
          checkStreakCount(streakCount)
        })
      })
    }
  }, [user])

  useEffect(() => {
    // Animate content in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start()

    // Carregar dados do usuário
    if (user) {
      loadUserData()
      calculateStreak()

      // Subscription para alterações na tabela emotion_entries
      const emotionEntriesSubscription = supabase
        .channel("emotion_entries_changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "emotion_entries" }, (payload) => {
          calculateStreak() // Recalcular o streak
          updateMoodCount() // Atualizar o número de registros
        })
        .subscribe()

      // Subscription para alterações na tabela profiles
      const profilesSubscription = supabase
        .channel("profiles_changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (payload) => {
          updatePoints() // Atualizar os pontos
        })
        .subscribe()

      // Limpar as subscriptions ao desmontar o componente
      return () => {
        supabase.removeChannel(emotionEntriesSubscription)
        supabase.removeChannel(profilesSubscription)
      }
    }
  }, [user])

  const updateMoodCount = async () => {
    try {
      const { count, error } = await supabase
        .from("emotion_entries")
        .select("id", { count: "exact" })
        .eq("user_id", user?.id)

      if (error) throw error

      setMoodCount(count || 0)
    } catch (error) {}
  }

  const updatePoints = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("points").eq("user_id", user?.id).single()

      if (error) throw error

      setPoints(data?.points || 0)
    } catch (error) {}
  }

  // Função para carregar dados do usuário
  const loadUserData = async () => {
    try {
      setLoading(true)

      // Atualizar pontos
      await updatePoints()

      // Atualizar número de registros
      await updateMoodCount()

      // Buscar perfil do usuário
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, points")
        .eq("user_id", user?.id)
        .single()

      if (profileError) throw profileError

      if (profileData) {
        setUserName(profileData.full_name?.split(" ")[0] || "")
        setUserAvatar(profileData.avatar_url)
        setPoints(profileData.points || 0)
      }

      // Contar registros de humor
      const { count, error: countError } = await supabase
        .from("emotion_entries")
        .select("id", { count: "exact" })
        .eq("user_id", user?.id)

      if (countError) throw countError

      setMoodCount(count || 0)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  // Função para verificar o streak e mostrar o modal
  const checkStreakCount = (streakCount: number) => {
    if (streakCount >= 3) {
      onCheckComplete(streakCount)
    }
  }

  // Função para calcular o streak diário
  const calculateStreak = async () => {
    try {
      if (!user) return

      // Obter a data atual no formato ISO (YYYY-MM-DD)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Buscar todas as entradas do usuário, ordenadas por data
      const { data, error } = await supabase
        .from("emotion_entries")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        setStreakCount(0)
        return
      }

      // Converter timestamps para objetos Date e agrupar por dia
      const entriesByDay = new Map<string, boolean>()

      data.forEach((entry) => {
        const entryDate = new Date(entry.created_at)
        const dateString = entryDate.toISOString().split("T")[0] // YYYY-MM-DD
        entriesByDay.set(dateString, true)
      })

      // Verificar se há entrada para hoje
      const todayString = today.toISOString().split("T")[0]
      let currentStreak = entriesByDay.has(todayString) ? 1 : 0

      // Se não há entrada hoje, verificar se há entrada de ontem para continuar a contagem
      if (currentStreak === 0) {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayString = yesterday.toISOString().split("T")[0]

        if (!entriesByDay.has(yesterdayString)) {
          setStreakCount(0)
          return
        }

        currentStreak = 1
        today.setDate(today.getDate() - 1) // Começar a verificar a partir de ontem
      }

      // Verificar dias consecutivos anteriores
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - 1) // Começar do dia anterior

      while (true) {
        const checkDateString = checkDate.toISOString().split("T")[0]

        if (entriesByDay.has(checkDateString)) {
          currentStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else {
          break
        }
      }

      setStreakCount(currentStreak)

      // Verificar o streak após calcular
      checkStreakCount(currentStreak)
    } catch (error) {
      setStreakCount(0)
    }
  }

  const navigateTo = (route: string) => {
    router.push(route)
  }

  // Determinar saudação com base na hora do dia
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Bom dia"
    if (hour < 18) return "Boa tarde"
    return "Boa noite"
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header com avatar e saudação */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.headerContent}>
            <View style={styles.greetingContainer}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.userName}>{userName}</Text>
            </View>

            <TouchableOpacity style={styles.avatarContainer} onPress={() => navigateTo("/(tabs)/profile")}>
              {Platform.OS === "web" && userAvatar ? (
                <img src={userAvatar || "/placeholder.svg"} alt="" style={styles.avatar} />
              ) : Platform.OS !== "web" && userAvatar ? (
                <Image source={{ uri: userAvatar }} style={styles.avatar} resizeMode="contain" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{userName ? userName.charAt(0).toUpperCase() : "U"}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Como você está se sentindo hoje?</Text>
        </Animated.View>

        {/* Streak e estatísticas */}
        <Animated.View
          style={[
            styles.statsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: Animated.multiply(slideAnim, 1.1) }],
            },
          ]}
        >
          <StreakIndicator count={streakCount} />
          <StatsCard moodCount={moodCount} points={points} isLoading={loading} />
        </Animated.View>

        {/* <TestNotificationButton />
        <RandomNotificationButton /> */}

        {/* Seção de ações rápidas */}
        <Animated.View
          style={[
            styles.quickActionsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: Animated.multiply(slideAnim, 1.2) }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Ações Rápidas</Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.quickActionItem} onPress={() => navigateTo("/(tabs)/diary")}>
              <View style={[styles.quickActionIcon, styles.diaryIcon]}>
                <Text style={styles.quickActionIconText}>📔</Text>
              </View>
              <Text style={styles.quickActionText}>Meu Diário</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionItem} onPress={() => navigateTo("/(tabs)/stories")}>
              <View style={[styles.quickActionIcon, styles.diaryIcon]}>
                <Text style={styles.quickActionIconText}>📖</Text>
              </View>
              <Text style={styles.quickActionText}>Histórias</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionItem} onPress={() => navigateTo("/(tabs)/chat")}>
              <View style={[styles.quickActionIcon, styles.chatIcon]}>
                <Text style={styles.quickActionIconText}>💬</Text>
              </View>
              <Text style={styles.quickActionText}>Falar com Dra.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionItem} onPress={() => navigateTo("/(tabs)/profile")}>
              <View style={[styles.quickActionIcon, styles.profileIcon]}>
                <Text style={styles.quickActionIconText}>👤</Text>
              </View>
              <Text style={styles.quickActionText}>Meu Perfil</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Cards principais */}
        <Animated.View
          style={[
            {
              opacity: fadeAnim,
              transform: [{ translateY: Animated.multiply(slideAnim, 1.2) }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Atividades</Text>
        </Animated.View>

        {/* Card de Agendamentos */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: Animated.multiply(slideAnim, 1.5) }],
            },
          ]}
        >
          <TouchableOpacity style={styles.card} onPress={() => navigateTo("/appointmentsScreen")} activeOpacity={0.8}>
            <LinearGradient
              colors={["#F8BBD9", "#F4A6CD"]}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardIconContainer}>
                  <Text style={styles.cardIcon}>📅</Text>
                </View>
                <View style={styles.cardTextContent}>
                  <Text style={styles.cardTitle}>Agendamentos</Text>
                  <Text style={styles.cardDescription}>Agende consultas com a Doutora ou veja seus agendamentos.</Text>
                </View>
                <View style={styles.cardAction}>
                  <Text style={styles.cardActionText}>Acessar</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: Animated.multiply(slideAnim, 1.7) }],
            },
          ]}
        >
          <TouchableOpacity style={styles.card} onPress={() => navigateTo("/challenges")} activeOpacity={0.8}>
            <LinearGradient
              colors={["#F163E0", "#D14EC4"]}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardIconContainer}>
                  <Text style={styles.cardIcon}>🏆</Text>
                </View>
                <View style={styles.cardTextContent}>
                  <Text style={styles.cardTitle}>Desafios</Text>
                  <Text style={styles.cardDescription}>Complete desafios para desenvolver habilidades emocionais.</Text>
                </View>
                <View style={styles.cardAction}>
                  <Text style={styles.cardActionText}>Explorar</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: Animated.multiply(slideAnim, 1.7) }],
            },
          ]}
        >
          <TouchableOpacity style={styles.card} onPress={() => navigateTo("/rewards")} activeOpacity={0.8}>
            <LinearGradient
              colors={["#B03CA9", "#8F2A8E"]}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.cardContent}>
                <View style={styles.cardIconContainer}>
                  <Text style={styles.cardIcon}>🏆</Text>
                </View>
                <View style={styles.cardTextContent}>
                  <Text style={styles.cardTitle}>Recompensas</Text>
                  <Text style={styles.cardDescription}>
                    Veja e Resgate suas Recompensas dos Desafios Diários e Semanais.
                  </Text>
                </View>
                <View style={styles.cardAction}>
                  <Text style={styles.cardActionText}>Explorar</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
      <StreakModal visible={modalState.visible} onClose={handleCloseModal} streak={modalState.streak} />
    </SafeAreaView>
  )
}

const { width } = Dimensions.get("window")

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: "#6B7280",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 4,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  streakContainer: {
    width: "48%",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  streakGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  streakIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  streakIcon: {
    fontSize: 20,
  },
  streakTextContainer: {
    flex: 1,
  },
  streakCount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  streakLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  statsCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    justifyContent: "center",
  },
  statsContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
  },
  statDivider: {
    width: 1,
    height: "80%",
    backgroundColor: "#E5E7EB",
    marginHorizontal: 8,
  },
  quickActionsContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  quickActionItem: {
    width: "48%",
    alignItems: "center",
    marginBottom: 16,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  moodIcon: {
    backgroundColor: "rgba(241, 99, 224, 0.1)",
  },
  chatIcon: {
    backgroundColor: "rgba(176, 60, 169, 0.1)",
  },
  profileIcon: {
    backgroundColor: "rgba(143, 42, 142, 0.1)",
  },
  diaryIcon: {
    backgroundColor: "rgba(109, 26, 109, 0.1)",
  },
  quickActionIconText: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
  },
  cardContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardGradient: {
    width: "100%",
  },
  cardContent: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  cardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 20,
  },
  cardAction: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginLeft: 8,
  },
  cardActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  logoutContainer: {
    padding: 20,
    marginTop: 24,
    alignItems: "center",
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4B5563",
  },
})
