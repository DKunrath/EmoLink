"use client"

import { useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  SafeAreaView,
  Image,
  Alert,
  Modal,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { supabase } from "../../services/supabase"
import { useAuth } from "../../hooks/useAuth"
import { LinearGradient } from "expo-linear-gradient"

// Interface para as recompensas
interface Reward {
  id: string
  name: string
  description: string
  type: "badge" | "content"
  gender_type: string
  image_url: string
  points_required: number
  condition: boolean
  content_url?: string
  content_type?: "video" | "pdf"
  created_at: string
}

// Interface para as recompensas do usuário
interface UserReward {
  id: string
  user_id: string
  reward_id: string
  redeemed_at: string
}

const RewardsScreen = () => {
  const [badges, setBadges] = useState<Reward[]>([])
  const [contents, setContents] = useState<Reward[]>([])
  const [userPoints, setUserPoints] = useState<number>(0)
  const [badgeCondition, setBadgeCondition] = useState<boolean>(false)
  const [redeemedRewardIds, setRedeemedRewardIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const { user } = useAuth()
  const navigation = useNavigation()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  // Função para buscar recompensas e pontos do usuário
  const fetchRewardsAndPoints = async () => {
    try {
      setLoading(true)

      if (!user) {
        console.log("Usuário ainda não carregado, tentando novamente em breve...")
        setTimeout(fetchRewardsAndPoints, 1000) // Tentar novamente em 1 segundo
        return
      }

      // 1. Buscar pontos do usuário
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("points, gender")
        .eq("user_id", user.id)
        .single()

      if (profileError) {
        throw profileError
      }

      setUserPoints(profileData?.points || 0)

      // 2. Buscar recompensas já resgatadas pelo usuário
      const { data: userRewards, error: userRewardsError } = await supabase
        .from("user_rewards")
        .select("reward_id")
        .eq("user_id", user.id)

      if (userRewardsError) {
        throw userRewardsError
      }

      const redeemedIds = userRewards?.map((r) => r.reward_id) || []
      setRedeemedRewardIds(redeemedIds)

      // 3. Buscar todas as recompensas
      const { data: allRewards, error: rewardsError } = await supabase
        .from("rewards")
        .select("*")
        .order("points_required", { ascending: true })

      if (rewardsError) {
        throw rewardsError
      }

      // Separar insígnias e conteúdos
      const badgeRewards = allRewards?.filter(
        (r) => (r.gender_type === profileData.gender || r.gender_type === "all") && r.type === "badge"
      ) || [];
      const contentRewards = allRewards?.filter((r) => r.type === "content") || []
      const userBadgeCondition = badgeRewards.some((reward) => reward.condition)

      setBadges(badgeRewards)
      setContents(contentRewards)
      setBadgeCondition(userBadgeCondition)

      // Animar a entrada dos componentes
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
      console.error("Erro ao buscar recompensas:", error)
    } finally {
      setLoading(false)
    }
  }

  // Função para resgatar uma recompensa
  const redeemReward = async (reward: Reward) => {
    try {
      if (!user) {
        Alert.alert("Erro", "Você precisa estar logado para resgatar recompensas.")
        return
      }

      if (userPoints < reward.points_required) {
        Alert.alert("Pontos insuficientes", "Você não tem pontos suficientes para resgatar esta recompensa.")
        return
      }

      if(!badgeCondition && reward.type === "badge") {
        Alert.alert("Condição não atendida", "Você precisa atender a condição para resgatar esta insígnia.")
        return
      }

      setRedeeming(true)

      // Registrar a recompensa como resgatada
      const { error: redeemError } = await supabase.from("user_rewards").insert([
        {
          user_id: user.id,
          reward_id: reward.id,
        },
      ])

      if (redeemError) {
        throw redeemError
      }

      // Atualizar a lista de recompensas resgatadas
      setRedeemedRewardIds([...redeemedRewardIds, reward.id])

      // Mostrar mensagem de sucesso
      Alert.alert("Recompensa Resgatada!", `Você resgatou com sucesso: ${reward.name}`, [
        {
          text: "OK",
          onPress: () => {
            setModalVisible(false)
            setSelectedReward(null)
          },
        },
      ])

      // Atualizar a lista de recompensas
      fetchRewardsAndPoints()
    } catch (error) {
      console.error("Erro ao resgatar recompensa:", error)
      Alert.alert("Erro", "Não foi possível resgatar a recompensa. Tente novamente mais tarde.")
    } finally {
      setRedeeming(false)
    }
  }

  // Função para abrir o modal de detalhes da recompensa
  const openRewardDetails = (reward: Reward) => {
    setSelectedReward(reward)
    setModalVisible(true)
  }

  // Carregar recompensas ao montar o componente
  useEffect(() => {
    if (user) {
      fetchRewardsAndPoints()
    } else {
      // Se o usuário ainda não estiver carregado, configurar um intervalo para verificar
      const checkAuthInterval = setInterval(() => {
        if (user) {
          fetchRewardsAndPoints()
          clearInterval(checkAuthInterval)
        }
      }, 500)

      // Limpar o intervalo quando o componente for desmontado
      return () => clearInterval(checkAuthInterval)
    }
  }, [user])

  // Atualizar recompensas quando a tela receber foco
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (user) {
        fetchRewardsAndPoints()
      }
    })

    return unsubscribe
  }, [navigation, user])

  // Função para renderizar uma recompensa
  const renderReward = (reward: Reward, index: number) => {
    const isRedeemed = redeemedRewardIds.includes(reward.id)
    const canRedeem = userPoints >= reward.points_required
    const conditionMet = reward.condition
    const statusText = isRedeemed
      ? "Resgatado"
      : canRedeem
        ? "Disponível"
        : `Faltam ${reward.points_required - userPoints} pontos`

    const statusTextCondition = conditionMet
      ? "Condição atendida"
      : conditionMet
        ? "Condição atendida"
        : `Condição não atendida`

    return (
      <Animated.View
        key={reward.id}
        style={[
          styles.rewardCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.rewardCardContent}
          onPress={() => openRewardDetails(reward)}
          activeOpacity={0.8}
        >
          <View style={styles.rewardImageContainer}>
            {reward.image_url ? (
              <Image source={{ uri: reward.image_url }} style={styles.rewardImage} />
            ) : (
              <View style={styles.rewardImagePlaceholder}>
                <Text style={styles.rewardImagePlaceholderText}>{reward.type === "badge" ? "🏆" : "📄"}</Text>
              </View>
            )}
          </View>

          <View style={styles.rewardInfo}>
            <Text style={styles.rewardName}>{reward.name}</Text>
            <Text style={styles.rewardPointsValue}>Condição para Desbloquear</Text>
            <Text style={styles.rewardDescription} numberOfLines={2} ellipsizeMode="tail">
              {reward.description}
            </Text>
            <View style={styles.rewardPointsContainer}>
              <Text style={styles.rewardPointsLabel}>Pontos necessários:</Text>
              <Text style={styles.rewardPointsValue}>{reward.points_required}</Text>
            </View>

            <View style={{ flexDirection: "column", justifyContent: "space-evenly", alignItems: "center" }}>
              <View
                style={[
                  styles.rewardStatus1,
                  isRedeemed ? styles.redeemedStatus : canRedeem ? styles.availableStatus : styles.lockedStatus,
                ]}
              >
                <Text
                  style={[
                    styles.rewardStatusText,
                    isRedeemed
                      ? styles.redeemedStatusText
                      : canRedeem
                        ? styles.availableStatusText
                        : styles.lockedStatusText,
                  ]}
                >
                  {statusText}
                </Text>
              </View>

              <View
                style={[
                  styles.rewardStatus2,
                  isRedeemed ? styles.redeemedStatus : canRedeem ? styles.availableStatus : styles.lockedStatus,
                ]}
              >
                <Text
                  style={[
                    styles.rewardStatusText,
                    isRedeemed
                      ? styles.redeemedStatusText
                      : canRedeem
                        ? styles.availableStatusText
                        : styles.lockedStatusText,
                  ]}
                >
                  {statusTextCondition}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  // Modal de detalhes da recompensa
  const renderRewardDetailsModal = () => {
    if (!selectedReward) return null

    const isRedeemed = redeemedRewardIds.includes(selectedReward.id)
    const canRedeem = userPoints >= selectedReward.points_required

    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setModalVisible(false)
          setSelectedReward(null)
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                setModalVisible(false)
                setSelectedReward(null)
              }}
            >
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalImageContainer}>
                {selectedReward.image_url ? (
                  <Image source={{ uri: selectedReward.image_url }} style={styles.modalImage} />
                ) : (
                  <View style={styles.modalImagePlaceholder}>
                    <Text style={styles.modalImagePlaceholderText}>
                      {selectedReward.type === "badge" ? "🏆" : "📄"}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.modalTitle}>{selectedReward.name}</Text>
              <Text style={styles.modalDescription}>{selectedReward.description}</Text>

              <View style={styles.modalPointsContainer}>
                <Text style={styles.modalPointsLabel}>Pontos necessários:</Text>
                <Text style={styles.modalPointsValue}>{selectedReward.points_required}</Text>
              </View>

              <View style={styles.modalPointsContainer}>
                <Text style={styles.modalPointsLabel}>Seus pontos:</Text>
                <Text style={styles.modalPointsValue}>{userPoints}</Text>
              </View>

              {selectedReward.type === "content" && selectedReward.content_type && (
                <View style={styles.modalContentTypeContainer}>
                  <Text style={styles.modalContentTypeLabel}>Tipo de conteúdo:</Text>
                  <Text style={styles.modalContentTypeValue}>
                    {selectedReward.content_type === "video" ? "Vídeo" : "Documento PDF"}
                  </Text>
                </View>
              )}

              {isRedeemed ? (
                <View style={styles.modalRedeemedContainer}>
                  <Text style={styles.modalRedeemedText}>Recompensa já resgatada!</Text>

                  {selectedReward.type === "content" && selectedReward.content_url && (
                    <TouchableOpacity
                      style={styles.modalViewContentButton}
                      onPress={() => {
                        // Implementar visualização do conteúdo
                        Alert.alert("Visualizar conteúdo", "Funcionalidade a ser implementada")
                      }}
                    >
                      <Text style={styles.modalViewContentButtonText}>
                        {selectedReward.content_type === "video" ? "Assistir Vídeo" : "Ver Documento"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.modalRedeemButton, (!canRedeem || redeeming) && styles.modalRedeemButtonDisabled]}
                  onPress={() => redeemReward(selectedReward)}
                  disabled={!canRedeem || redeeming}
                >
                  {redeeming ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalRedeemButtonText}>
                      {canRedeem
                        ? "Resgatar Recompensa"
                        : `Faltam ${selectedReward.points_required - userPoints} pontos`}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>Carregando recompensas...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Recompensas</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Seção de pontos do usuário */}
        <Animated.View
          style={[
            styles.pointsCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={["#F163E0", "#D14EC4"]}
            style={styles.pointsGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={styles.pointsContent}>
              <View style={styles.pointsIconContainer}>
                <Text style={styles.pointsIcon}>🎮</Text>
              </View>
              <View style={styles.pointsTextContainer}>
                <Text style={styles.pointsValue}>{userPoints}</Text>
                <Text style={styles.pointsLabel}>Pontos acumulados</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Seção de Insígnias */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insígnias</Text>
          <Text style={styles.sectionDescription}>
            Colecione insígnias especiais ao completar desafios e acumular pontos.
          </Text>

          {badges.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhuma insígnia disponível no momento!</Text>
              <Text style={styles.emptySubtext}>Novas insígnias serão adicionadas em breve.</Text>
            </View>
          ) : (
            badges.map((badge, index) => renderReward(badge, index))
          )}
        </View>

        {/* Seção de Conteúdos Exclusivos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conteúdos Exclusivos</Text>
          <Text style={styles.sectionDescription}>
            Desbloqueie vídeos e documentos especiais sobre desenvolvimento emocional.
          </Text>

          {contents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum conteúdo exclusivo disponível no momento!</Text>
              <Text style={styles.emptySubtext}>Novos conteúdos serão adicionados em breve.</Text>
            </View>
          ) : (
            contents.map((content, index) => renderReward(content, index))
          )}
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={fetchRewardsAndPoints}>
          <Text style={styles.refreshButtonText}>Atualizar Recompensas</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de detalhes da recompensa */}
      {renderRewardDetailsModal()}
    </SafeAreaView>
  )
}

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
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: "#F163E0",
    fontWeight: "600",
    fontSize: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  placeholder: {
    width: 60, // Mesmo tamanho do botão de voltar para manter o título centralizado
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  pointsCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  pointsGradient: {
    width: "100%",
    padding: 20,
  },
  pointsContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  pointsIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  pointsIcon: {
    fontSize: 30,
  },
  pointsTextContainer: {
    flex: 1,
  },
  pointsValue: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  pointsLabel: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
  },
  rewardCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    overflow: "hidden",
  },
  rewardCardContent: {
    flexDirection: "row",
    padding: 16,
  },
  rewardImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 16,
    alignSelf: "center", // Centraliza horizontalmente na coluna
    justifyContent: "center", // Centraliza verticalmente o conteúdo
  },
  rewardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  rewardImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  rewardImagePlaceholderText: {
    fontSize: 30,
  },
  rewardInfo: {
    flex: 1,
    justifyContent: "space-between",
  },
  rewardName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  rewardPointsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  rewardPointsLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginRight: 4,
  },
  rewardPointsValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#111827",
  },
  rewardStatus1: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 8,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  rewardStatus2: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  redeemedStatus: {
    backgroundColor: "#D1FAE5",
  },
  availableStatus: {
    backgroundColor: "#EEF2FF",
  },
  lockedStatus: {
    backgroundColor: "#FEF2F2",
  },
  rewardStatusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  redeemedStatusText: {
    color: "#059669",
  },
  availableStatusText: {
    color: "#4F46E5",
  },
  lockedStatusText: {
    color: "#DC2626",
  },
  emptyContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  refreshButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  // Estilos do modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    position: "relative",
  },
  modalCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "bold",
  },
  modalScrollContent: {
    padding: 24,
    paddingTop: 20,
  },
  modalImageContainer: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
  },
  modalImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  modalImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  modalImagePlaceholderText: {
    fontSize: 60,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 16,
    color: "#4B5563",
    lineHeight: 24,
    marginBottom: 20,
  },
  modalPointsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  modalPointsLabel: {
    fontSize: 16,
    color: "#6B7280",
  },
  modalPointsValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  modalContentTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
  },
  modalContentTypeLabel: {
    fontSize: 16,
    color: "#6B7280",
  },
  modalContentTypeValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  modalRedeemedContainer: {
    alignItems: "center",
    marginTop: 12,
  },
  modalRedeemedText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#059669",
    marginBottom: 16,
  },
  modalViewContentButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  modalViewContentButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  modalRedeemButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  modalRedeemButtonDisabled: {
    backgroundColor: "#F8BBF0",
  },
  modalRedeemButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
})

export default RewardsScreen
