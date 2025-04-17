"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  Alert,
  Dimensions,
  Animated,
  Modal,
  Platform,
} from "react-native"
import { supabase } from "../../../services/supabase"
import * as Crypto from "expo-crypto"
import ParentDiary from "./parentDiary"
import LeaderboardScreen from "./leaderboardScreen"
import InstructionsScreen from "./InstructionsScreen"
import { useAuth } from "../../../hooks/useAuth"
import { useAlertContext } from "../../../components/alert-provider"

interface UserReward {
  id: string
  user_id: string
  reward_id: string
  redeemed_at: string
  reward?: {
    id: string
    name: string
    description: string
    points_required: number
    image_url: string
    type: string
  }
}

// ID da doutora
const DOCTOR_ID = "b46ab255-8937-4904-9ba1-3d533027b0d9"

// Fetch profile data from Supabase
const fetchProfileData = async () => {
  try {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, email")
      .eq("id", (await supabase.auth.getUser()).data?.user?.id)
      .single()

    if (userError) throw userError

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, parent_password, points, level")
      .eq("user_id", user.id)
      .single()

    if (profileError) throw profileError

    return {
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      email: user.email,
      has_parent_password: !!profile.parent_password,
      points: profile.points,
      level: profile.level,
    }
  } catch (error) {
    console.error("Error fetching profile data:", error)
    return {
      full_name: "",
      avatar_url: "",
      email: "",
      has_parent_password: false,
      points: 0,
    }
  }
}

// Save profile data to Supabase
const saveProfileData = async (data: { full_name: string; avatar_url: string }) => {
  try {
    const user = await supabase.auth.getUser()
    if (!user.data?.user) throw new Error("User not authenticated")

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        avatar_url: data.avatar_url,
      })
      .eq("user_id", user.data.user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error("Error saving profile data:", error)
    return false
  }
}

// Hash password using SHA-256
const hashPassword = async (password: string) => {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password)
  return hash
}

// Save parent password to Supabase
const saveParentPassword = async (password: string) => {
  try {
    const user = await supabase.auth.getUser()
    if (!user.data?.user) throw new Error("User not authenticated")

    const hashedPassword = await hashPassword(password)

    const { error } = await supabase
      .from("profiles")
      .update({
        parent_password: hashedPassword,
      })
      .eq("user_id", user.data.user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error("Error saving parent password:", error)
    return false
  }
}

// Verify parent password
const verifyParentPassword = async (password: string) => {
  try {
    const user = await supabase.auth.getUser()
    if (!user.data?.user) throw new Error("User not authenticated")

    const { data, error } = await supabase
      .from("profiles")
      .select("parent_password")
      .eq("user_id", user.data.user.id)
      .single()

    if (error) throw error

    const hashedPassword = await hashPassword(password)
    return data.parent_password === hashedPassword
  } catch (error) {
    console.error("Error verifying parent password:", error)
    return false
  }
}

const ProfileScreen = () => {
  const [fullName, setFullName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [email, setEmail] = useState("")
  const [points, setPoints] = useState(0)
  const [level, setLevel] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasParentPassword, setHasParentPassword] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showParentDiary, setShowParentDiary] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  const { user } = useAuth()
  const { success, error2 } = useAlertContext()
  const [profile, setProfile] = useState(null)
  const [userRewards, setUserRewards] = useState<UserReward[]>([])
  const [selectedReward, setSelectedReward] = useState<UserReward | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0]
  const slideAnim = useState(new Animated.Value(50))[0]

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)
      const data = await fetchProfileData()
      setFullName(data.full_name)
      setAvatarUrl(data.avatar_url)
      setEmail(data.email)
      setHasParentPassword(data.has_parent_password)
      setPoints(data.points)
      setLevel(data.level)
      setLoading(false)

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
    }

    loadProfile()
  }, [])

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchUserRewards()
    }
  }, [user])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      if (!user) return

      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single()

      if (error) {
        throw error
      }

      setProfile(data)
    } catch (error) {
      console.error("Error fetching profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserRewards = async () => {
    try {
      if (!user) return

      // Fetch user rewards with reward details
      const { data, error } = await supabase
        .from("user_rewards")
        .select(`
          id, 
          user_id, 
          reward_id, 
          redeemed_at,
          rewards:reward_id (
            id, 
            name, 
            description, 
            points_required, 
            image_url,
            type
          )
        `)
        .eq("user_id", user.id)
        .order("redeemed_at", { ascending: false })

      if (error) {
        throw error
      }

      // Transform the data to match our UserReward interface
      const transformedData = data.map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        reward_id: item.reward_id,
        redeemed_at: item.redeemed_at,
        reward: {
          id: item.rewards?.id,
          name: item.rewards?.name,
          description: item.rewards?.description,
          points_required: item.rewards?.points_required,
          image_url: item.rewards?.image_url,
          type: item.rewards?.type,
        },
      }))

      setUserRewards(transformedData)
    } catch (error) {
      console.error("Error fetching user rewards:", error)
    }
  }

  const handleRewardPress = (reward: UserReward) => {
    setSelectedReward(reward)
    setTooltipVisible(true)
  }

  // Group rewards by difficulty based on points_required
  const groupRewardsByDifficulty = () => {
    const bronze = userRewards.filter((reward) => reward.reward && reward.reward.points_required <= 50)
    const silver = userRewards.filter(
      (reward) => reward.reward && reward.reward.points_required > 50 && reward.reward.points_required <= 150,
    )
    const gold = userRewards.filter(
      (reward) => reward.reward && reward.reward.points_required > 150 && reward.reward.points_required <= 300,
    )
    const diamond = userRewards.filter((reward) => reward.reward && reward.reward.points_required > 300)

    return { bronze, silver, gold, diamond }
  }

  const { bronze, silver, gold, diamond } = groupRewardsByDifficulty()

  const renderAchievementSection = (title: string, rewards: UserReward[], color: string) => {
    if (rewards.length === 0) return null

    return (
      <View style={styles.achievementSection}>
        <View style={[styles.achievementHeader, { backgroundColor: color }]}>
          <Text style={styles.achievementHeaderText}>{title}</Text>
        </View>
        <View style={styles.badgesContainer}>
          {rewards.map(
            (userReward) =>
              userReward.reward && (
                <TouchableOpacity
                  key={userReward.id}
                  style={styles.badgeItem}
                  onPress={() => handleRewardPress(userReward)}
                >
                  {userReward.reward.image_url ? (
                    Platform.OS === "web" ? (
                      <img
                        src={userReward.reward.image_url || "/placeholder.svg"}
                        alt={userReward.reward.name}
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <Image
                        source={{ uri: userReward.reward.image_url }}
                        style={styles.badgeImage}
                        resizeMode="contain"
                      />
                    )
                  ) : (
                    <View style={[styles.badgePlaceholder, { backgroundColor: color }]}>
                      <Text style={styles.badgePlaceholderText}>{userReward.reward.name.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={styles.badgeName} numberOfLines={1}>
                    {userReward.reward.name}
                  </Text>
                </TouchableOpacity>
              ),
          )}
        </View>
      </View>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    const success = await saveProfileData({ full_name: fullName, avatar_url: avatarUrl })
    setSaving(false)

    if (success) {
      Alert.alert("Sucesso", "Seu perfil foi atualizado com sucesso!")
      setIsEditing(false)
    } else {
      Alert.alert("Erro", "Falha ao atualizar o perfil. Por favor, tente novamente.")
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    // Reset to original values
    fetchProfileData().then((data) => {
      setFullName(data.full_name)
      setAvatarUrl(data.avatar_url)
      setIsEditing(false)
    })
  }

  const handleParentAccess = async () => {
    try{
      const user = await supabase.auth.getUser()
      if(user.data.user?.id === DOCTOR_ID) {
        setShowParentDiary(true)
        return
      } else {
        setPassword("")
        setConfirmPassword("")
        setPasswordError("")
        setPasswordModalVisible(true)
      }
    } catch (error) {
      console.error("Error fetching user:", error)
    }
  }

  const handleRankingAccess = () => {
    setShowLeaderboard(true)
  }

  const handleInstructionsAccess = () => {
    setShowInstructions(true)
  }

  const handlePasswordSubmit = async () => {
    // Validate password
    if (!hasParentPassword && password !== confirmPassword) {
      setPasswordError("As senhas não coincidem")
      return
    }

    if (password.length < 6) {
      setPasswordError("A senha deve ter pelo menos 6 caracteres")
      return
    }

    setPasswordLoading(true)

    try {
      if (hasParentPassword) {
        // Verify existing password
        const isValid = await verifyParentPassword(password)
        if (isValid) {
          setPasswordModalVisible(false)
          setShowParentDiary(true)
        } else {
          setPasswordError("Senha incorreta")
        }
      } else {
        // Create new password
        const success = await saveParentPassword(password)
        if (success) {
          setHasParentPassword(true)
          setPasswordModalVisible(false)
          setShowParentDiary(true)
          Alert.alert("Sucesso", "Senha criada com sucesso!")
        } else {
          setPasswordError("Erro ao criar senha. Tente novamente.")
        }
      }
    } catch (error) {
      console.error("Error handling password:", error)
      setPasswordError("Ocorreu um erro. Tente novamente.")
    } finally {
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>Carregando seu perfil...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{fullName ? fullName.charAt(0).toUpperCase() : "U"}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{fullName || "Usuário"}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{points || 0}</Text>
            <Text style={styles.statLabel}>Pontos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{userRewards.length}</Text>
            <Text style={styles.statLabel}>Conquistas</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{level || 1}</Text>
            <Text style={styles.statLabel}>Nível</Text>
          </View>
        </View>

        {/* Achievements Section */}
        <View style={styles.achievementsContainer}>
          <Text style={styles.achievementsTitle}>Conquistas</Text>

          {userRewards.length === 0 ? (
            <View style={styles.emptyAchievements}>
              <Text style={styles.emptyText}>
                Você ainda não possui conquistas. Complete desafios para ganhar emblemas!
              </Text>
            </View>
          ) : (
            <>
              {renderAchievementSection("Bronze", bronze, "#CD7F32")}
              {renderAchievementSection("Prata", silver, "#C0C0C0")}
              {renderAchievementSection("Ouro", gold, "#FFD700")}
              {renderAchievementSection("Diamante", diamond, "#B9F2FF")}
            </>
          )}
        </View>

          {/* Ranking Button */}
          <TouchableOpacity style={styles.rankingButton} onPress={handleRankingAccess}>
            <Text style={styles.rankingButtonText}>Ranking</Text>
          </TouchableOpacity>

          {/* Parent Access Button */}
          <TouchableOpacity style={styles.parentAccessButton} onPress={handleParentAccess}>
            <Text style={styles.parentAccessButtonText}>Acesso Pais</Text>
          </TouchableOpacity>

          {/* Instructions Button */}
          <TouchableOpacity style={styles.instructionsButton} onPress={handleInstructionsAccess}>
            <Text style={styles.instructionsButtonText}>Instruções</Text>
          </TouchableOpacity>
      </ScrollView>

      {/* Achievement Tooltip Modal */}
      <Modal
        visible={tooltipVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setTooltipVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTooltipVisible(false)}>
          <View style={styles.tooltipContainer}>
            {selectedReward && selectedReward.reward && (
              <>
                <View style={styles.tooltipHeader}>
                  <Text style={styles.tooltipTitle}>{selectedReward.reward.name}</Text>
                </View>

                <View style={styles.tooltipContent}>
                  <View style={styles.tooltipImageContainer}>
                    {selectedReward.reward.image_url ? (
                      Platform.OS === "web" ? (
                        <img
                          src={selectedReward.reward.image_url || "/placeholder.svg"}
                          alt={selectedReward.reward.name}
                          style={{
                            width: 80,
                            height: 80,
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <Image
                          source={{ uri: selectedReward.reward.image_url }}
                          style={styles.tooltipImage}
                          resizeMode="contain"
                        />
                      )
                    ) : (
                      <View style={styles.tooltipPlaceholder}>
                        <Text style={styles.tooltipPlaceholderText}>{selectedReward.reward.name.charAt(0)}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.tooltipDescription}>{selectedReward.reward.description}</Text>

                  <View style={styles.tooltipDetails}>
                    <Text style={styles.tooltipDetailLabel}>Pontos necessários:</Text>
                    <Text style={styles.tooltipDetailValue}>{selectedReward.reward.points_required}</Text>
                  </View>

                  <View style={styles.tooltipDetails}>
                    <Text style={styles.tooltipDetailLabel}>Conquistado em:</Text>
                    <Text style={styles.tooltipDetailValue}>
                      {new Date(selectedReward.redeemed_at).toLocaleDateString()}
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.tooltipCloseButton} onPress={() => setTooltipVisible(false)}>
                    <Text style={styles.tooltipCloseButtonText}>Fechar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Password Modal */}
      <Modal visible={passwordModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{hasParentPassword ? "Digite sua senha" : "Crie uma senha"}</Text>

            {!hasParentPassword && (
              <Text style={styles.modalSubtitle}>Esta senha será usada para acessar o diário dos pais</Text>
            )}

            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={(text) => {
                setPassword(text)
                setPasswordError("")
              }}
              placeholder="Digite sua senha"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />

            {!hasParentPassword && (
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text)
                  setPasswordError("")
                }}
                placeholder="Confirme sua senha"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
            )}

            {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setPasswordModalVisible(false)}
                disabled={passwordLoading}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitButton, passwordLoading && styles.modalSubmitButtonDisabled]}
                onPress={handlePasswordSubmit}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>{hasParentPassword ? "Entrar" : "Criar Senha"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Parent Diary Modal */}
      <Modal visible={showParentDiary} animationType="slide" onRequestClose={() => setShowParentDiary(false)}>
        <ParentDiary onClose={() => setShowParentDiary(false)} />
      </Modal>

      {/* Leaderboard Modal */}
      <Modal visible={showLeaderboard} animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.leaderboardContainer}>
            <View style={styles.leaderboardHeader}>
              <Text style={styles.leaderboardTitle}>Ranking</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowLeaderboard(false)}>
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
            <LeaderboardScreen />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Instructions Modal */}
      <Modal visible={showInstructions} animationType="slide" onRequestClose={() => setShowInstructions(false)}>
        <InstructionsScreen onClose={() => setShowInstructions(false)} />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  profileHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: "#6B7280",
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  statDivider: {
    width: 1,
    height: "80%",
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#F163E0",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  logoutButton: {
    backgroundColor: "#EF4444",
  },
  logoutButtonText: {
    color: "#FFFFFF",
  },
  // Achievements styles
  achievementsContainer: {
    marginTop: 24,
    marginBottom: 24,
  },
  achievementsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  achievementSection: {
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  achievementHeader: {
    padding: 12,
    backgroundColor: "#CD7F32", // Default bronze color
  },
  achievementHeaderText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
  },
  badgeItem: {
    width: "25%", // 4 badges per row
    alignItems: "center",
    marginBottom: 16,
  },
  badgeImage: {
    width: 60,
    height: 60,
    marginBottom: 4,
  },
  badgePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  badgePlaceholderText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  badgeName: {
    fontSize: 12,
    color: "#4B5563",
    textAlign: "center",
    paddingHorizontal: 4,
  },
  emptyAchievements: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  // Tooltip Modal styles
  tooltipModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    width: "90%",
    maxWidth: 350,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tooltipHeader: {
    backgroundColor: "#F163E0",
    padding: 16,
    alignItems: "center",
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  tooltipContent: {
    padding: 16,
    alignItems: "center",
  },
  tooltipImageContainer: {
    marginBottom: 16,
  },
  tooltipImage: {
    width: 80,
    height: 80,
  },
  tooltipPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
  },
  tooltipPlaceholderText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  tooltipDescription: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  tooltipDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tooltipDetailLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  tooltipDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
  tooltipCloseButton: {
    marginTop: 16,
    backgroundColor: "#F163E0",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  tooltipCloseButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  rankingButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  rankingButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  parentAccessButton: {
    backgroundColor: "#F59E0B",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  parentAccessButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  instructionsButton: {
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  instructionsButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "center",
  },
  passwordInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: "#111827",
    marginBottom: 16,
  },
  passwordError: {
    color: "#EF4444",
    marginBottom: 16,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  modalCancelButtonText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 16,
  },
  modalSubmitButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#F163E0",
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
  },
  modalSubmitButtonDisabled: {
    backgroundColor: "#ED77DF",
  },
  modalSubmitButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  // Leaderboard Styles
  leaderboardContainer: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  leaderboardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
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
})

export default ProfileScreen
