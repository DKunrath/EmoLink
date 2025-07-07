"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Image,
} from "react-native"
import { supabase } from "../services/supabase"
import { useAuth } from "../hooks/useAuth"
import { router } from "expo-router"
import { MaterialIcons } from "@expo/vector-icons";
import { useAlertContext } from "../components/alert-provider"

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

// Interface para os personagens
interface Character {
  name: string
  id: string
  image: string
}

// Lista de personagens disponíveis
const characters: Character[] = [
  { name: "Amy", id: "amy", image: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Amy.png" },
  { name: "Angelita", id: "angelita", image: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Angelita.png" },
  { name: "Grãozinho", id: "graozinho", image: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Angelita.png" },
  { name: "Lili", id: "lili", image: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Angelita.png" },
]

interface LeaderboardScreenProps {
  onClose?: () => void
}

const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ onClose }) => {
  const [users, setUsers] = useState<LeaderboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  // Novos estados para controlar o tipo de ranking e personagem selecionado
  const [rankingType, setRankingType] = useState<"users" | "characters">("users")
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  const { error2} = useAlertContext()

  // Verificar se o usuário atual é a doutora
  const isDoctor = user?.id === DOCTOR_ID

  // Lista de nomes de animais para substituir os nomes dos usuários
  const animalNames = [
    "Leão", "Tigre", "Elefante", "Girafa", "Zebra", "Panda", "Koala", "Canguru",
    "Lobo", "Raposa", "Urso", "Golfinho", "Baleia", "Tubarão", "Águia", "Falcão",
    "Coruja", "Pinguim", "Tucano", "Flamingo", "Macaco", "Gorila", "Rinoceronte",
    "Hipopótamo", "Crocodilo", "Tartaruga", "Cobra", "Lagarto", "Camaleão", "Sapo",
  ]

  const handleCharacterSelect = (character: Character) => {
    setSelectedCharacter(character);
    setModalVisible(false); // Fecha o modal após a seleção
  };

  // Função para buscar os usuários com mais pontos
  const fetchUserLeaderboard = async () => {
    try {
      setLoading(true)

      // Verificar se o usuário está autenticado
      if (!user) {
        return // Retorna sem executar o restante da função
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
      animateContent()
    } catch (error) {
      error2("Erro ao buscar leaderboard", "Ocorreu um erro ao buscar o leaderboard.")
    } finally {
      setLoading(false)
    }
  }

  // Função para buscar o ranking por personagem
  const fetchCharacterLeaderboard = async (character: Character) => {
    try {
      setLoading(true)
      setSelectedCharacter(character)

      // Verificar se o usuário está autenticado
      if (!user) {
        return
      }

      // Primeiro, precisamos buscar todos os desafios concluídos com o personagem selecionado
      const { data: challenges, error: challengesError } = await supabase
        .from("challenges")
        .select("challenge_id, challenge_character")
        .eq("challenge_character", character.name)

      if (challengesError) {
        throw challengesError
      }

      // Se não houver desafios para este personagem, retornar lista vazia
      if (!challenges || challenges.length === 0) {
        setUsers([])
        setLoading(false)
        return
      }

      // Extrair IDs dos desafios para este personagem
      const challengeIds = challenges.map(c => c.challenge_id)

      // Buscar todos os desafios concluídos para os IDs de desafio encontrados
      const { data: completedChallenges, error: completedError } = await supabase
        .from("completed_challenges")
        .select("user_id, challenge_id, challenge_type")
        .in("challenge_id", challengeIds)

      if (completedError) {
        throw completedError
      }

      // Calcular pontos por usuário
      const userPoints: Record<string, number> = {}

      completedChallenges.forEach(challenge => {
        const userId = challenge.user_id
        let points = 0

        // Atribuir pontos com base no tipo de desafio
        switch (challenge.challenge_type) {
          case "daily":
            points = 3
            break
          case "weekly":
            points = 5
            break
          case "parents":
            points = 10
            break
          default:
            points = 0
        }

        // Adicionar pontos ao usuário
        if (!userPoints[userId]) {
          userPoints[userId] = 0
        }
        userPoints[userId] += points
      })

      // Buscar informações dos usuários
      const userIds = Object.keys(userPoints)

      if (userIds.length === 0) {
        setUsers([])
        setLoading(false)
        return
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name")
        .in("user_id", userIds)

      if (profilesError) {
        throw profilesError
      }

      // Criar o ranking
      const leaderboardData = profiles.map(profile => {
        const userId = profile.user_id
        const points = userPoints[userId] || 0

        return {
          id: profile.id,
          user_id: userId,
          full_name: profile.full_name,
          display_name: profile.full_name, // Será ajustado abaixo
          points: points,
          rank: 0, // Será ajustado abaixo
        }
      })

      // Ordenar por pontos e adicionar rank
      leaderboardData.sort((a, b) => b.points - a.points)

      // Limitar a 10 resultados se não for a doutora
      const limitedData = !isDoctor ? leaderboardData.slice(0, 10) : leaderboardData

      // Adicionar rank e ajustar nomes de exibição
      const formattedData = limitedData.map((item, index) => {
        const isCurrentUser = user.id === item.user_id
        const animalIndex = index % animalNames.length
        const displayName = isDoctor || isCurrentUser ? item.full_name : animalNames[animalIndex]

        return {
          ...item,
          display_name: displayName,
          rank: index + 1,
        }
      })

      setUsers(formattedData)
      animateContent()
    } catch (error) {
      error2("Erro ao buscar leaderboard", "Ocorreu um erro ao buscar o leaderboard.")
    } finally {
      setLoading(false)
    }
  }

  // Função para animar a entrada dos itens
  const animateContent = () => {
    // Reset animation values
    fadeAnim.setValue(0)
    slideAnim.setValue(50)

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
  }

  // Efeito para carregar os dados ao montar o componente
  useEffect(() => {
    if (rankingType === "users") {
      fetchUserLeaderboard()
    } else {
      setSelectedCharacter(characters.find(character => character.name === "Amy") || null)
      if (selectedCharacter) {
        fetchCharacterLeaderboard(selectedCharacter)
      }
    }
  }, [user, rankingType, selectedCharacter])

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

  // Renderizar botões de alternância entre rankings
  const renderToggleButtons = () => {
    return (
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            rankingType === "users" && styles.toggleButtonActive
          ]}
          onPress={() => setRankingType("users")}
        >
          <Text style={[
            styles.toggleButtonText,
            rankingType === "users" && styles.toggleButtonTextActive
          ]}>
            Ranking Usuários
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleButton,
            rankingType === "characters" && styles.toggleButtonActive
          ]}
          onPress={() => setRankingType("characters")}
        >
          <Text style={[
            styles.toggleButtonText,
            rankingType === "characters" && styles.toggleButtonTextActive
          ]}>
            Ranking Personagens
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Renderizar botões de seleção de personagem
  const renderCharacterButtons = () => {
    if (rankingType !== "characters") return null

    return (
      <View>
        {/* Botão para abrir o modal */}
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.selectButtonText}>
            {selectedCharacter ? selectedCharacter.name : "Selecione o personagem"}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }

  // Renderizar mensagem informativa
  const renderInfoMessage = () => {
    if (rankingType === "users") {
      return (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>Ganhe 2 pontos para cada registro de emoção!</Text>
        </View>
      )
    } else if (rankingType === "characters" && selectedCharacter) {
      return (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Pontuação por desafio: Diário (3 pts), Semanal (5 pts), Familiar (10 pts)
          </Text>
        </View>
      )
    }

    return null
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

      {/* Botões de alternância entre rankings */}
      {renderToggleButtons()}

      {rankingType === "characters" && (
        <Text style={styles.selectCharacterText}>
          Selecione o personagem
        </Text>
      )}

      {/* Botões de seleção de personagem */}
      {renderCharacterButtons()}

      {/* Mensagem informativa */}
      {renderInfoMessage()}

      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Nenhum usuário encontrado</Text>
          <Text style={styles.emptySubtitle}>
            {rankingType === "users"
              ? "Comece a registrar suas emoções para aparecer no ranking!"
              : "Nenhum usuário completou desafios com este personagem ainda."}
          </Text>
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
            keyExtractor={(item) => item.id + (selectedCharacter?.id || "")}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
      {/* Modal para selecionar o personagem */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecione o personagem</Text>
            <FlatList
              data={characters}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.characterItem}
                  onPress={() => handleCharacterSelect(item)}
                >
                  {Platform.OS === "web" ? (
                    <img
                      src={item.image}
                      alt=""
                      style={styles.characterImage}
                    />
                  ) : (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.characterImage}
                      resizeMode="contain"
                    />
                  )}
                  <Text style={styles.characterName}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    padding: 16,
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
    marginTop: 16,
    backgroundColor: "#F163E0",
    borderRadius: 8,
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  infoContainer: {
    backgroundColor: "#FFEEFF",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#F163F1",
  },
  infoText: {
    fontSize: 14,
    color: "#000000",
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
    backgroundColor: "#FFEEFF",
    borderWidth: 1,
    borderColor: "#F163F1",
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
    color: "#000000",
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
  // Novos estilos para os botões de alternância
  toggleContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  toggleButtonActive: {
    backgroundColor: "#F163E0",
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  toggleButtonTextActive: {
    color: "#FFFFFF",
  },
  // Estilos para os botões de personagem
  characterButtonsContainer: {
    flexDirection: "row", // Alinha os botões horizontalmente
    justifyContent: "space-around", // Distribui os botões uniformemente
    paddingHorizontal: 8, // Espaçamento horizontal
    paddingVertical: 8, // Espaçamento vertical
    alignItems: "center", // Centraliza os botões verticalmente
  },
  characterButton: {
    paddingHorizontal: 10, // Espaçamento interno horizontal do botão
    paddingVertical: 4, // Espaçamento interno vertical do botão (menor altura)
    marginHorizontal: 4, // Espaçamento entre os botões
    borderRadius: 8, // Bordas arredondadas menores
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center", // Centraliza o conteúdo horizontalmente
    justifyContent: "center", // Centraliza o conteúdo verticalmente
  },
  characterButtonActive: {
    backgroundColor: "#F163E0",
    borderColor: "#F163E0",
  },
  characterButtonText: {
    fontSize: 14, // Tamanho do texto
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center", // Garante que o texto fique centralizado
  },
  characterButtonTextActive: {
    color: "#FFFFFF",
  },
  selectButton: {
    marginTop: 16,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: "#F163E0",
    borderRadius: 8,
    alignItems: "center",
    textAlign: "center",
    flexDirection: "row", // Alinha o texto e o ícone na mesma linha
    justifyContent: "center", // Espaça o texto e o ícone
  },
  selectButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  characterItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  characterImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  characterName: {
    fontSize: 16,
    color: "#111827",
  },
  selectCharacterText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 16,
    marginHorizontal: 16,
    alignItems: "center",
    textAlign: "center",
  },
})

export default LeaderboardScreen