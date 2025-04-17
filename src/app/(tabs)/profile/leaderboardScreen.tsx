"use client"

import { useEffect, useState, useRef } from "react"
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Animated, Dimensions, SafeAreaView } from "react-native"
import { supabase } from "../../../services/supabase"
import { useAuth } from "../../../hooks/useAuth"

// ID da doutora
const DOCTOR_ID = "b46ab255-8937-4904-9ba1-3d533027b0d9"

// Interface para os usuários do leaderboard
interface LeaderboardUser {
  id: string
  user_id: string
  full_name: string
  display_name: string // Nome a ser exibido (animal ou nome real)
  points: number
  rank: number
}

const LeaderboardScreen = () => {
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  // Verificar se o usuário atual é a doutora
  const isDoctor = user?.id === DOCTOR_ID

  // Lista de nomes de animais para substituir os nomes dos usuários
  const animalNames = [
    "Leão",
    "Tigre",
    "Elefante",
    "Girafa",
    "Zebra",
    "Panda",
    "Koala",
    "Canguru",
    "Lobo",
    "Raposa",
    "Urso",
    "Golfinho",
    "Baleia",
    "Tubarão",
    "Águia",
    "Falcão",
    "Coruja",
    "Pinguim",
    "Tucano",
    "Flamingo",
    "Macaco",
    "Gorila",
    "Rinoceronte",
    "Hipopótamo",
    "Crocodilo",
    "Tartaruga",
    "Cobra",
    "Lagarto",
    "Camaleão",
    "Sapo",
  ]

  // Função para buscar os usuários com mais pontos
  const fetchLeaderboard = async () => {
    try {
      setLoading(true)

      // Verificar se o usuário está autenticado
      if (!user) {
        console.warn("Usuário não autenticado");
        return; // Retorna sem executar o restante da função
      }

      // Construir a consulta base
      let query = supabase
        .from("profiles")
        .select("id, user_id, full_name, points")
        .neq("full_name", "Ana Claudia Cavalcanti")
        .order("points", { ascending: false })

      // Se não for a doutora, limitar a 10 resultados
      if (!isDoctor) {
        query = query.limit(10)
      }

      // Executar a consulta
      const { data, error } = await query

      if (error) {
        throw error
      }

      // Formatar os dados e adicionar a classificação
      const formattedData = data.map((item, index) => {
        // Verificar se é o usuário atual
        const isCurrentUser = user.id === item.user_id

        // Determinar o nome a ser exibido
        // Se for a doutora, mostrar o nome completo de todos
        // Se não for a doutora, mostrar apenas o nome completo do usuário atual
        const animalIndex = index % animalNames.length
        const displayName = isDoctor || isCurrentUser ? item.full_name : animalNames[animalIndex]

        return {
          id: item.id,
          user_id: item.user_id,
          full_name: item.full_name,
          display_name: displayName,
          points: item.points || 0,
          rank: index + 1,
        }
      })

      setUsers(formattedData)

      // Animar a entrada dos itens
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
    } catch (error) {
      console.error("Erro ao buscar leaderboard:", error)
    } finally {
      setLoading(false)
    }
  }

  // Efeito para carregar os dados ao montar o componente
  useEffect(() => {
    fetchLeaderboard()
  }, [user]) // Adicionar user como dependência para recarregar quando o usuário mudar

  // Função para renderizar o ícone de medalha para os 3 primeiros lugares
  const renderMedal = (rank: number) => {
    if (rank === 1) {
      return (
        <View style={[styles.medalContainer, styles.goldMedal]}>
          <Text style={styles.medalText}>1</Text>
        </View>
      )
    } else if (rank === 2) {
      return (
        <View style={[styles.medalContainer, styles.silverMedal]}>
          <Text style={styles.medalText}>2</Text>
        </View>
      )
    } else if (rank === 3) {
      return (
        <View style={[styles.medalContainer, styles.bronzeMedal]}>
          <Text style={styles.medalText}>3</Text>
        </View>
      )
    } else {
      return (
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>{rank}</Text>
        </View>
      )
    }
  }

  // Renderizar item da lista
  const renderItem = ({ item }: { item: LeaderboardUser }) => {
    // Verificar se é o usuário atual
    const isCurrentUser = user?.id === item.user_id

    return (
      <Animated.View
        style={[
          styles.itemContainer,
          isCurrentUser && styles.currentUserContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.rankSection}>{renderMedal(item.rank)}</View>

        <View style={styles.nameSection}>
          <Text style={[styles.nameText, isCurrentUser && styles.currentUserText]}>{item.display_name}</Text>
        </View>

        <View style={styles.pointsSection}>
          <Text style={[styles.pointsText, isCurrentUser && styles.currentUserText]}>{item.points} pts</Text>
        </View>
      </Animated.View>
    )
  }

  // Tela de carregamento
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>Carregando classificação...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Classificação</Text>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>Ganhe 2 pontos para cada registro de emoção!</Text>
      </View>

      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Nenhum usuário encontrado</Text>
          <Text style={styles.emptySubtitle}>Comece a registrar suas emoções para aparecer no ranking!</Text>
        </View>
      ) : (
        <>
          <View style={styles.listHeader}>
            <View style={styles.rankSection}>
              <Text style={styles.listHeaderText}>Pos.</Text>
            </View>
            <View style={styles.nameSection}>
              <Text style={styles.listHeaderText}>Paciente</Text>
            </View>
            <View style={styles.pointsSection}>
              <Text style={styles.listHeaderText}>Pontos</Text>
            </View>
          </View>

          <FlatList
            data={users}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
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
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  infoContainer: {
    backgroundColor: "#EEF2FF",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },
  infoText: {
    fontSize: 14,
    color: "#4F46E5",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#F163E0",
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  listHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  listHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  itemContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    alignItems: "center",
  },
  currentUserContainer: {
    backgroundColor: "#F8F7FF",
    borderWidth: 1,
    borderColor: "#6366F1",
  },
  rankSection: {
    width: 50,
    alignItems: "center",
  },
  nameSection: {
    flex: 1,
    paddingHorizontal: 10,
  },
  pointsSection: {
    width: 80,
    alignItems: "flex-end",
  },
  rankText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#6B7280",
  },
  nameText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  pointsText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F163E0",
  },
  currentUserText: {
    color: "#6366F1",
  },
  medalContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  goldMedal: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  silverMedal: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#9CA3AF",
  },
  bronzeMedal: {
    backgroundColor: "#FDE68A",
    borderWidth: 1,
    borderColor: "#D97706",
  },
  medalText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  rankContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
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
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
})

export default LeaderboardScreen

