"use client"

import { useState, useCallback, useRef } from "react"
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
  PanResponder,
  FlatList,
} from "react-native"
import { supabase } from "../../../services/supabase"
import * as ImagePicker from "expo-image-picker"
import { Feather } from "@expo/vector-icons"
import { useAuth } from "../../../hooks/useAuth"
import { useAlertContext } from "../../../components/alert-provider"
import { useFocusEffect } from "@react-navigation/native"
import { decode } from "base64-arraybuffer"
import * as FileSystem from "expo-file-system"
import { PointsHistorySection } from '../../../components/PointsHistorySection';
//import { Avataars } from 'rn-customize-avatar/avataaars';

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

const profileBackgrounds = [
  { id: 0, name: "Padrão", imageUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//background_image_0.png", requiredPoints: 0 },
  { id: 1, name: "Encantados", imageUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//background_image_1.jpg", requiredPoints: 50 },
  { id: 2, name: "Minions", imageUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//background_image_2.jpg", requiredPoints: 100 },
  { id: 3, name: "Toy Story", imageUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//background_image_3.jpg", requiredPoints: 200 },
  { id: 5, name: "Branca de Neve", imageUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//background_image_4.jpg", requiredPoints: 300 },
  { id: 6, name: "Branca de Nev", imageUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//background_image_4.jpg", requiredPoints: 400 },
  { id: 7, name: "Branca de Ne", imageUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//background_image_4.jpg", requiredPoints: 500 },
  { id: 8, name: "Branca de N", imageUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//background_image_4.jpg", requiredPoints: 800 },
];

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
      .select("full_name, avatar_url, parent_password, points, level, background_url")
      .eq("user_id", user.id)
      .single()

    if (profileError) throw profileError

    return {
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      email: user.email,
      has_parent_password: !!profile.parent_password,
      points: profile.points || 0,
      level: profile.level || 1,
      background_url: profile.background_url
    }
  } catch (error) {
    return {
      full_name: "",
      avatar_url: "",
      email: "",
      has_parent_password: false,
      points: 0,
      level: 1,
      background_url: profileBackgrounds[0].imageUrl, // Use default background if not set
    }
  }
}

// Save profile data to Supabase
const saveProfileData = async (data: { full_name: string; avatar_url: string; background_url: string }) => {
  try {
    const user = await supabase.auth.getUser()
    if (!user.data?.user) throw new Error("User not authenticated")

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        background_url: data.background_url,
      })
      .eq("user_id", user.data.user.id)

    if (error) throw error
    return true
  } catch (error) {
    return false
  }
}

// Add the uriToBase64 function outside the component
const uriToBase64 = async (uri: string): Promise<string | null> => {
  try {
    if (Platform.OS === "web") {
      // For web platform
      const response = await fetch(uri)
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === "string") {
            // Remove the data:image/jpeg;base64, prefix
            const base64 = reader.result.split(",")[1]
            resolve(base64)
          } else {
            reject(new Error("Failed to convert to base64"))
          }
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } else {
      // For native platforms
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      return base64
    }
  } catch (error) {
    return null
  }
}

const ProfileScreen = () => {
  const [fullName, setFullName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [email, setEmail] = useState("")
  const [points, setPoints] = useState(0)
  const [level, setLevel] = useState(1)
  const [backgroundUrl, setBackgroundUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  // New states for image adjustment
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null)
  const [showImageAdjustment, setShowImageAdjustment] = useState(false)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [imageScale, setImageScale] = useState(1)
  const [lastPinchDistance, setLastPinchDistance] = useState(0)

  const { user } = useAuth()
  const { success, error2 } = useAlertContext()
  const [userRewards, setUserRewards] = useState<UserReward[]>([])
  const [selectedReward, setSelectedReward] = useState<UserReward | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [selectedBackground, setSelectedBackground] = useState(profileBackgrounds[0]); // Fundo padrão
  // Add these state variables at the beginning of the ProfileScreen component
  const [currentBackgroundPage, setCurrentBackgroundPage] = useState(0);
  const backgroundsPerPage = 6;

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0]
  const slideAnim = useState(new Animated.Value(50))[0]

  const renderBackgroundOptions = () => {
    // Calculate pagination
    const totalPages = Math.ceil(profileBackgrounds.length / backgroundsPerPage);
    const startIndex = currentBackgroundPage * backgroundsPerPage;
    const endIndex = Math.min(startIndex + backgroundsPerPage, profileBackgrounds.length);
    const currentBackgrounds = profileBackgrounds.slice(startIndex, endIndex);

    return (
      <View>
        <View style={styles.backgroundOptionsContainer}>
          {currentBackgrounds.map((background) => (
            <TouchableOpacity
              key={background.id}
              style={[
                styles.backgroundOption,
                selectedBackground.id === background.id && styles.backgroundOptionSelected,
              ]}
              onPress={() => {
                if (points >= background.requiredPoints) {
                  setSelectedBackground(background);
                } else {
                  Alert.alert(
                    "Fundo Bloqueado",
                    `Você precisa de ${background.requiredPoints} pontos para desbloquear este fundo.`
                  );
                }
              }}
            >
              <Image source={{ uri: background.imageUrl }} style={styles.backgroundImage} />
              <Text style={styles.backgroundName}>{background.name}</Text>
              {points < background.requiredPoints && (
                <Text style={styles.backgroundLockedText}>Bloqueado</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <View style={styles.paginationContainer}>
            <TouchableOpacity
              style={[styles.paginationButton, currentBackgroundPage === 0 && styles.paginationButtonDisabled]}
              onPress={() => setCurrentBackgroundPage(prev => Math.max(0, prev - 1))}
              disabled={currentBackgroundPage === 0}
            >
              <Feather name="chevron-left" size={20} color={currentBackgroundPage === 0 ? "#D1D5DB" : "#111827"} />
            </TouchableOpacity>

            <Text style={styles.paginationText}>
              {currentBackgroundPage + 1} / {totalPages}
            </Text>

            <TouchableOpacity
              style={[styles.paginationButton, currentBackgroundPage === totalPages - 1 && styles.paginationButtonDisabled]}
              onPress={() => setCurrentBackgroundPage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={currentBackgroundPage === totalPages - 1}
            >
              <Feather name="chevron-right" size={20} color={currentBackgroundPage === totalPages - 1 ? "#D1D5DB" : "#111827"} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Pan responder for image adjustment
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        // Handle pinch to zoom
        if (evt.nativeEvent.changedTouches && evt.nativeEvent.changedTouches.length === 2) {
          const touch1 = evt.nativeEvent.changedTouches[0]
          const touch2 = evt.nativeEvent.changedTouches[1]

          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) + Math.pow(touch2.pageY - touch1.pageY, 2),
          )

          if (lastPinchDistance) {
            const change = distance - lastPinchDistance
            const newScale = Math.max(1, Math.min(3, imageScale + change / 200))
            setImageScale(newScale)
          }

          setLastPinchDistance(distance)
        }
        // Handle drag to position
        else {
          setImagePosition({
            x: imagePosition.x + gestureState.dx,
            y: imagePosition.y + gestureState.dy,
          })
        }
      },
      onPanResponderRelease: () => {
        setLastPinchDistance(0)
      },
    }),
  ).current

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      const loadAllData = async () => {
        setLoading(true)
        await Promise.all([loadProfileData(), fetchUserRewards()])
        setLoading(false)
      }

      loadAllData()

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

      return () => {
        // Reset animation values when screen is unfocused
        fadeAnim.setValue(0)
        slideAnim.setValue(50)
      }
    }, [user]),
  )

  const loadProfileData = async () => {
    const data = await fetchProfileData()
    setFullName(data.full_name)
    setAvatarUrl(data.avatar_url)
    setEmail(data.email)
    setPoints(data.points)
    setLevel(data.level)
    setBackgroundUrl(data.background_url)
    setSelectedBackground(profileBackgrounds.find(bg => bg.imageUrl === data.background_url) || profileBackgrounds[0]) // Set default background if not found
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
      return false
    }
  }

  // Function to delete existing avatar files for the user
  const deleteExistingAvatarFiles = async () => {
    try {
      if (!user) return

      // List all files in the "avatars/avatars" subfolder
      const { data, error } = await supabase.storage.from("avatars").list("avatars")

      if (error) {
        return
      }

      // Filter files that match the user ID pattern
      const filesToDelete = data
        ?.filter((file) => file.name.startsWith(`${user.id}_avatar`))
        .map((file) => `avatars/${file.name}`) // Include the subfolder path

      if (filesToDelete && filesToDelete.length > 0) {
        // Delete the filtered files
        const { error: deleteError } = await supabase.storage.from("avatars").remove(filesToDelete)

      }
    } catch (error) {
      return false
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
    const success2 = await saveProfileData({ full_name: fullName, avatar_url: avatarUrl, background_url: selectedBackground.imageUrl })
    setSaving(false)

    if (success2) {
      success("Sucesso", "Seu perfil foi atualizado com sucesso!")
      setIsEditing(false)
    } else {
      error2("Erro", "Falha ao atualizar o perfil. Por favor, tente novamente.")
      setIsEditing(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    // Reset to original values
    fetchProfileData().then((data) => {
      setFullName(data.full_name);
      setAvatarUrl(data.avatar_url);
      setBackgroundUrl(data.background_url);

      // Find and set the correct background object based on the URL from the database
      const originalBackground = profileBackgrounds.find(bg => bg.imageUrl === data.background_url) || profileBackgrounds[0];
      setSelectedBackground(originalBackground);

      setIsEditing(false);
    });
  }

  // Step 1: Pick image from gallery
  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de permissão para acessar sua galeria de fotos.")
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"], // Substitua MediaTypeOptions.Images por um array
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Set the selected image URI and show adjustment modal
        setSelectedImageUri(result.assets[0].uri)
        // Reset position and scale
        setImagePosition({ x: 0, y: 0 })
        setImageScale(1)
        setShowImageAdjustment(true)
      }
    } catch (error) {
      error2("Erro", "Falha ao selecionar imagem. Tente novamente.")
    }
  }

  // Step 2: Upload the adjusted image
  const uploadAdjustedImage = async () => {
    if (!selectedImageUri || !user) {
      return
    }

    setUploadingImage(true)
    setShowImageAdjustment(false)

    try {
      // Delete existing avatar files first
      await deleteExistingAvatarFiles()

      // Generate a unique file name
      const fileName = `${user.id}_avatar_${Date.now()}.png`
      const filePath = `avatars/${fileName}`

      // Convert URI to base64
      const base64 = await uriToBase64(selectedImageUri)
      if (!base64) {
        throw new Error("Falha ao converter imagem para base64")
      }

      // Upload to Supabase Storage using base64
      const { data, error: uploadError } = await supabase.storage.from("avatars").upload(filePath, decode(base64), {
        contentType: "image/png",
        upsert: true,
      })

      if (uploadError) throw uploadError

      // Get the public URL
      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath)

      if (publicUrlData) {
        // Update avatar URL in state and save to database
        const newAvatarUrl = publicUrlData.publicUrl
        setAvatarUrl(newAvatarUrl)

        const success2 = await saveProfileData({
          full_name: fullName,
          avatar_url: newAvatarUrl,
          background_url: selectedBackground.imageUrl,
        })

        if (success2) {
          success("Sucesso", "Foto de perfil atualizada com sucesso!")
        } else {
          error2("Erro", "Falha ao atualizar a foto de perfil. Tente novamente.")
        }
      }
    } catch (error) {
      error2("Erro", "Falha ao fazer upload da imagem. Tente novamente.")
    } finally {
      setUploadingImage(false)
      setSelectedImageUri(null)
    }
  }

  // Cancel image adjustment
  const cancelImageAdjustment = () => {
    setShowImageAdjustment(false)
    setSelectedImageUri(null)
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>Carregando seu perfil...</Text>
      </View>
    )
  }

  const renderHeader = () => (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.profileHeader, { backgroundColor: "transparent" }]}>
        <Image source={{ uri: selectedBackground.imageUrl }} style={styles.profileBackground} />
        <View style={styles.overlay}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity style={styles.avatarWrapper} onPress={pickImage} disabled={uploadingImage}>
              {avatarUrl ? (
                <>
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                  {uploadingImage && (
                    <View style={styles.avatarOverlay}>
                      <ActivityIndicator color="#FFFFFF" />
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>{fullName ? fullName.charAt(0).toUpperCase() : "U"}</Text>
                </View>
              )}
              <View style={styles.editAvatarButton}>
                <Feather name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.profileHeaderFields}>
        <View style={styles.nameContainer}>
          <Text style={styles.userName}>{fullName || "Usuário"}</Text>
          <TouchableOpacity style={styles.editNameButton} onPress={handleEdit}>
            <Feather name="edit-2" size={16} color="#F163E0" />
          </TouchableOpacity>
        </View>

        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      {isEditing && (
        <View style={styles.editContainer}>
          <Text style={styles.editLabel}>Nome</Text>
          <TextInput
            style={styles.editInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Seu nome"
            placeholderTextColor="#9CA3AF"
          />

          {/* Renderizar opções de fundos */}
          <Text style={styles.sectionTitle}>Escolha seu Fundo</Text>
          {renderBackgroundOptions()}

          <View style={styles.editButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

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

      {/* <View>
      <Text style={styles.achievementsTitle}>Avatar</Text>
      <View style={{ flex: 1 }}>
        <Avataars backgroundColor="grey" />
      </View>
    </View> */}

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
            {renderAchievementSection("Prata", silver, "#918C8C")}
            {renderAchievementSection("Ouro", gold, "#BD9F00")}
            {renderAchievementSection("Diamante", diamond, "#0EA2C4")}
          </>
        )}
      </View>
    </ScrollView>
  )

  return (
    <SafeAreaView style={styles.container}>
        <FlatList
          data={[]} // Use uma lista vazia, pois o conteúdo principal está no cabeçalho
          renderItem={null} // Nenhum item será renderizado
          ListHeaderComponent={renderHeader} // Renderiza o conteúdo acima do histórico de pontos
          ListFooterComponent={<PointsHistorySection />} // Renderiza o histórico de pontos como rodapé
          contentContainerStyle={styles.scrollContent}
        />

      {/* Image Adjustment Modal */}
      <Modal
        visible={showImageAdjustment}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelImageAdjustment}
      >
        <View style={styles.imageAdjustmentOverlay}>
          <View style={styles.imageAdjustmentContainer}>
            <Text style={styles.imageAdjustmentTitle}>Ajustar Imagem</Text>
            <Text style={styles.imageAdjustmentSubtitle}>Arraste para posicionar e use dois dedos para zoom</Text>

            <View style={styles.imageAdjustmentPreview}>
              <View style={styles.imageAdjustmentFrame} {...panResponder.panHandlers}>
                {selectedImageUri && (
                  <View style={styles.imageWrapper}>
                    <Image
                      source={{ uri: selectedImageUri }}
                      style={[
                        styles.adjustableImage,
                        {
                          transform: [
                            { translateX: imagePosition.x },
                            { translateY: imagePosition.y },
                            { scale: imageScale },
                          ],
                        },
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                )}
              </View>
            </View>

            <View style={styles.imageAdjustmentButtons}>
              <TouchableOpacity style={styles.imageAdjustmentCancelButton} onPress={cancelImageAdjustment}>
                <Text style={styles.imageAdjustmentCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.imageAdjustmentSaveButton} onPress={uploadAdjustedImage}>
                <Text style={styles.imageAdjustmentSaveText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  profileHeaderFields: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarWrapper: {
    position: "relative",
    width: 100,
    height: 100,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#E5E7EB",
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  nameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginRight: 8,
  },
  editNameButton: {
    padding: 4,
  },
  userEmail: {
    fontSize: 16,
    color: "#6B7280",
  },
  editContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
    marginBottom: 16,
  },
  editButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
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
  // Achievements styles
  achievementsContainer: {
    marginTop: 8,
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
  modalOverlay: {
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
    width: 300,
    height: 300,
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
  saveButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 8,
  },
  saveButtonDisabled: {
    backgroundColor: "#F8BBF0",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 14,
  },
  // Image Adjustment Modal Styles
  imageAdjustmentOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  imageAdjustmentContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 500,
    alignItems: "center",
  },
  imageAdjustmentTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  imageAdjustmentSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "center",
  },
  imageAdjustmentPreview: {
    width: "100%",
    aspectRatio: 1,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  imageAdjustmentFrame: {
    width: 250,
    height: 250,
    borderRadius: 125,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#F163E0",
    backgroundColor: "#F9FAFB",
  },
  imageWrapper: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  adjustableImage: {
    width: "100%",
    height: "100%",
  },
  imageAdjustmentButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  imageAdjustmentCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  imageAdjustmentCancelText: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 16,
  },
  imageAdjustmentSaveButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#F163E0",
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
  },
  imageAdjustmentSaveText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  profileBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    resizeMode: "cover",
    borderRadius: 10,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 50,
  },
  backgroundOptionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
  },
  backgroundOption: {
    width: 100,
    height: 120,
    margin: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
  },
  backgroundOptionSelected: {
    borderColor: "#F163E0",
    borderWidth: 2,
  },
  backgroundImage: {
    width: "100%",
    height: "70%",
    resizeMode: "cover",
  },
  backgroundName: {
    fontSize: 12,
    color: "#111827",
    marginTop: 4,
  },
  backgroundLockedText: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 2,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  paginationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  paginationButtonDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  paginationText: {
    fontSize: 14,
    color: "#111827",
    marginHorizontal: 12,
    fontWeight: "500",
  },
})

export default ProfileScreen
