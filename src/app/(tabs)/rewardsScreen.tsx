"use client"

import { useEffect, useState, useRef, useCallback } from "react"
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
  Modal,
  Platform,
} from "react-native"
import { useNavigation, useFocusEffect } from "@react-navigation/native"
import { supabase } from "../../services/supabase"
import { useAuth } from "../../hooks/useAuth"
import { LinearGradient } from "expo-linear-gradient"
// Adicionar a importação da função checkCondition no topo do arquivo
import { checkCondition } from "../../services/reward"
import { useAlertContext } from "../../components/alert-provider"

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
  const [redeemedRewardIds, setRedeemedRewardIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const { success, error2, warning } = useAlertContext()
  // Novo estado para armazenar os IDs das recompensas que têm suas condições atendidas
  const [metConditionIds, setMetConditionIds] = useState<string[]>([])
  const { user } = useAuth()
  const navigation = useNavigation()

  // Ref para controlar se já estamos buscando dados
  const isFetchingRef = useRef(false)
  // Ref para controlar se o componente está montado
  const isMountedRef = useRef(true)
  // Ref para armazenar timeouts que precisam ser limpos
  const timeoutsRef = useRef<NodeJS.Timeout[]>([])
  // Ref para controlar operações de cancelamento
  const abortControllerRef = useRef<AbortController | null>(null)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  // Função para limpar todos os timeouts
  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
    timeoutsRef.current = []
  }, [])

  // Função para adicionar um timeout que será limpo automaticamente
  const safeSetTimeout = useCallback((callback: () => void, delay: number) => {
    const timeoutId = setTimeout(() => {
      // Só executa o callback se o componente ainda estiver montado
      if (isMountedRef.current) {
        callback()
      }
      // Remove este timeout da lista após execução
      timeoutsRef.current = timeoutsRef.current.filter((id) => id !== timeoutId)
    }, delay)

    timeoutsRef.current.push(timeoutId)
    return timeoutId
  }, [])

  // Função para buscar recompensas e pontos do usuário - otimizada
  const fetchRewardsAndPoints = useCallback(async () => {
    // Evitar múltiplas chamadas simultâneas
    if (isFetchingRef.current || !isMountedRef.current) return

    // Cancelar qualquer operação anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Criar novo controlador para esta operação
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      isFetchingRef.current = true
      if (!isMountedRef.current) return
      setLoading(true)

      if (!user) {
        if (isMountedRef.current) {
          safeSetTimeout(() => {
            isFetchingRef.current = false
            if (isMountedRef.current) {
              fetchRewardsAndPoints()
            }
          }, 1000) // Tentar novamente em 1 segundo
        }
        return
      }

      // Verificar se a operação foi cancelada
      if (signal.aborted) return

      // 1. Buscar pontos do usuário
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("points, gender")
        .eq("user_id", user.id)
        .single()

      if (profileError) {
        throw profileError
      }

      // Verificar se a operação foi cancelada ou componente desmontado
      if (signal.aborted || !isMountedRef.current) return

      setUserPoints(profileData?.points || 0)

      // 2. Buscar recompensas já resgatadas pelo usuário
      const { data: userRewards, error: userRewardsError } = await supabase
        .from("user_rewards")
        .select("reward_id")
        .eq("user_id", user.id)

      if (userRewardsError) {
        throw userRewardsError
      }

      // Verificar se a operação foi cancelada ou componente desmontado
      if (signal.aborted || !isMountedRef.current) return

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

      // Verificar se a operação foi cancelada ou componente desmontado
      if (signal.aborted || !isMountedRef.current) return

      // Separar insígnias e conteúdos
      const badgeRewards =
        allRewards?.filter(
          (r) => (r.gender_type === profileData.gender || r.gender_type === "all") && r.type === "badge",
        ) || []
      const contentRewards = allRewards?.filter((r) => r.type === "content") || []

      if (isMountedRef.current) {
        setBadges(badgeRewards)
        setContents(contentRewards)
      }

      // 4. Verificar condições para cada recompensa - OTIMIZADO
      const metConditions: string[] = []

      // Adicionar automaticamente recompensas já resgatadas às condições atendidas
      metConditions.push(...redeemedIds)

      // Verificar condições apenas para insígnias não resgatadas
      const unredeemBadges = badgeRewards.filter((badge) => !redeemedIds.includes(badge.id))

      // Verificar se a operação foi cancelada ou componente desmontado
      if (signal.aborted || !isMountedRef.current) return

      // Usar Promise.all para verificar condições em paralelo
      const badgeConditionPromises = unredeemBadges.map(async (badge) => {
        try {
          // Verificar se a operação foi cancelada
          if (signal.aborted) return null

          const isConditionMet = await checkCondition(badge.id)
          if (isConditionMet) {
            return badge.id
          }
          return null
        } catch (error) {
          return null
        }
      })

      // Verificar se a operação foi cancelada ou componente desmontado
      if (signal.aborted || !isMountedRef.current) return

      const badgeResults = await Promise.all(badgeConditionPromises)
      metConditions.push(...(badgeResults.filter(Boolean) as string[]))

      // Verificar condições apenas para conteúdos não resgatados que têm condição
      const unredeemContents = contentRewards.filter(
        (content) => !redeemedIds.includes(content.id) && content.condition,
      )

      // Verificar se a operação foi cancelada ou componente desmontado
      if (signal.aborted || !isMountedRef.current) return

      const contentConditionPromises = unredeemContents.map(async (content) => {
        try {
          // Verificar se a operação foi cancelada
          if (signal.aborted) return null

          const isConditionMet = await checkCondition(content.id)
          if (isConditionMet) {
            return content.id
          }
          return null
        } catch (error) {
          return null
        }
      })

      // Verificar se a operação foi cancelada ou componente desmontado
      if (signal.aborted || !isMountedRef.current) return

      const contentResults = await Promise.all(contentConditionPromises)
      metConditions.push(...(contentResults.filter(Boolean) as string[]))

      // Adicionar conteúdos sem condição às condições atendidas
      const contentsWithoutCondition = contentRewards
        .filter((content) => !content.condition && !redeemedIds.includes(content.id))
        .map((content) => content.id)

      metConditions.push(...contentsWithoutCondition)

      // Verificar se a operação foi cancelada ou componente desmontado
      if (signal.aborted || !isMountedRef.current) return

      // Remover duplicatas
      const uniqueMetConditions = [...new Set(metConditions)]

      if (isMountedRef.current) {
        setMetConditionIds(uniqueMetConditions)

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
      }
    } catch (error) {
      if (!signal.aborted && isMountedRef.current) {
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
      isFetchingRef.current = false
    }
  }, [user, fadeAnim, slideAnim, safeSetTimeout])

  // Função para resgatar uma recompensa - otimizada
  const redeemReward = useCallback(
    async (reward: Reward) => {
      if (!isMountedRef.current) return

      try {
        if (!user) {
          error2("Erro!", " Você precisa estar logado para resgatar recompensas.");
          return
        }

        if (userPoints < reward.points_required) {
          error2("Pontos insuficientes", "Você não tem pontos suficientes para resgatar esta recompensa.")
          return
        }

        // Verificar se a condição foi atendida usando o estado metConditionIds
        const isConditionMet = metConditionIds.includes(reward.id)

        if (reward.type === "badge" && !isConditionMet) {
          error2("Condição não atendida", "Você precisa atender a condição para resgatar esta insígnia.")
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

        // Fechar o modal antes de mostrar a mensagem de sucesso
        if (isMountedRef.current) {
          setModalVisible(false)
        }

        // Atualizar a lista de recompensas resgatadas localmente
        if (isMountedRef.current) {
          setRedeemedRewardIds((prev) => [...prev, reward.id])
          // Adicionar à lista de condições atendidas
          setMetConditionIds((prev) => [...prev, reward.id])
        }

        // Mostrar mensagem de sucesso após um pequeno delay para garantir que o modal fechou
        safeSetTimeout(() => {
          if (isMountedRef.current) {
            success("Sucesso!", `Recompensa resgatada com sucesso: ${reward.name}`)
          }
        }, 300)
      } catch (error) {
        if (isMountedRef.current) {
          error2("Erro!", "Não foi possível resgatar a recompensa. Tente novamente mais tarde.")
        }
      } finally {
        if (isMountedRef.current) {
          setRedeeming(false)
        }
      }
    },
    [user, userPoints, metConditionIds, safeSetTimeout],
  )

  // Função para abrir o modal de detalhes da recompensa
  const openRewardDetails = useCallback((reward: Reward) => {
    if (isMountedRef.current) {
      setSelectedReward(reward)
      setModalVisible(true)
    }
  }, [])

  // Efeito para definir o componente como montado/desmontado
  useEffect(() => {
    isMountedRef.current = true

    return () => {
      // Marcar o componente como desmontado
      isMountedRef.current = false

      // Cancelar qualquer operação em andamento
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Limpar todos os timeouts
      clearAllTimeouts()
    }
  }, [clearAllTimeouts])

  // Usar useFocusEffect em vez de useEffect + navigation.addListener
  // Isso garante que o código só será executado quando a tela estiver em foco
  useFocusEffect(
    useCallback(() => {
      if (user && !isFetchingRef.current) {
        fetchRewardsAndPoints()
      }

      return () => {
        // Cancelar operações quando a tela perder o foco
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
      }
    }, [user, fetchRewardsAndPoints]),
  )

  // Função para renderizar uma recompensa - memoizada
  const renderReward = useCallback(
    (reward: Reward, index: number) => {
      const isRedeemed = redeemedRewardIds.includes(reward.id)
      const canRedeem = userPoints >= reward.points_required
      const conditionMet = metConditionIds.includes(reward.id)

      const statusText = isRedeemed
        ? "Resgatado"
        : canRedeem
          ? "Disponível"
          : `Faltam ${reward.points_required - userPoints} pontos`

      const statusTextCondition = conditionMet ? "Condição atendida" : "Condição não atendida"

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
                Platform.OS === "web" ? (
                  <img src={reward.image_url || "/placeholder.svg"} alt={reward.name} style={styles.rewardImage} />
                ) : (
                  <Image source={{ uri: reward.image_url }} style={styles.rewardImage} />
                )
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

                <View style={[styles.rewardStatus2, conditionMet ? styles.availableStatus : styles.lockedStatus]}>
                  <Text
                    style={[
                      styles.rewardStatusText,
                      conditionMet ? styles.availableStatusText : styles.lockedStatusText,
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
    },
    [fadeAnim, slideAnim, redeemedRewardIds, userPoints, metConditionIds, openRewardDetails],
  )

  // Modal de detalhes da recompensa - memoizado
  const renderRewardDetailsModal = useCallback(() => {
    if (!selectedReward) return null

    const isRedeemed = redeemedRewardIds.includes(selectedReward.id)
    const canRedeem = userPoints >= selectedReward.points_required
    const conditionMet = metConditionIds.includes(selectedReward.id)

    return (
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (isMountedRef.current) {
            setModalVisible(false)
            setSelectedReward(null)
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => {
                if (isMountedRef.current) {
                  setModalVisible(false)
                  setSelectedReward(null)
                }
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

              {selectedReward.type === "badge" && (
                <View
                  style={[
                    styles.modalConditionContainer,
                    conditionMet ? styles.modalConditionMet : styles.modalConditionNotMet,
                  ]}
                >
                  <Text style={styles.modalConditionLabel}>Status da condição:</Text>
                  <Text
                    style={[
                      styles.modalConditionValue,
                      conditionMet ? styles.modalConditionMetText : styles.modalConditionNotMetText,
                    ]}
                  >
                    {conditionMet ? "Atendida" : "Não atendida"}
                  </Text>
                </View>
              )}

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
                        warning("Atenção!", "Funcionalidade a ser implementada")
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
                  style={[
                    styles.modalRedeemButton,
                    (!canRedeem || !conditionMet || redeeming) && styles.modalRedeemButtonDisabled,
                  ]}
                  onPress={() => redeemReward(selectedReward)}
                  disabled={!canRedeem || !conditionMet || redeeming}
                >
                  {redeeming ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalRedeemButtonText}>
                      {!canRedeem
                        ? `Faltam ${selectedReward.points_required - userPoints} pontos`
                        : !conditionMet
                          ? "Condição não atendida"
                          : "Resgatar Recompensa"}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    )
  }, [selectedReward, modalVisible, redeemedRewardIds, userPoints, metConditionIds, redeeming, redeemReward])

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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Cancelar operações antes de navegar
            if (abortControllerRef.current) {
              abortControllerRef.current.abort()
            }
            clearAllTimeouts()
            navigation.goBack()
          }}
        >
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

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => {
            if (!isFetchingRef.current) {
              fetchRewardsAndPoints()
            }
          }}
        >
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
    backgroundColor: "#D1FAE5",
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
    color: "#059669",
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
    height: 300,
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
  modalConditionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalConditionMet: {
    backgroundColor: "#DCFCE7",
  },
  modalConditionNotMet: {
    backgroundColor: "#FEE2E2",
  },
  modalConditionLabel: {
    fontSize: 16,
    color: "#6B7280",
  },
  modalConditionValue: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalConditionMetText: {
    color: "#059669",
  },
  modalConditionNotMetText: {
    color: "#DC2626",
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
