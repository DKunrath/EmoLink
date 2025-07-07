"use client"

import React, { useEffect, useState } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Animated,
  SafeAreaView,
  Dimensions,
  TextInput,
  Modal,
  Image,
} from "react-native"
import { useNavigation, type NavigationProp, useFocusEffect } from "@react-navigation/native"
import type { RootStackParamList } from "../../../types/RootStackParamList"
import { supabase } from "../../../services/supabase"
import { useAuth } from "../../../hooks/useAuth"
import * as Crypto from "expo-crypto"

// ID da doutora
const DOCTOR_ID = "b46ab255-8937-4904-9ba1-3d533027b0d9"

interface Conversation {
  id: string
  user_id: string
  last_message: string
  updated_at: string
  patient_name: string
  unread_count_doctor: number
  unread_count_patient: number
  avatar_url?: string
}

const DoctorChats = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const auth = useAuth()
  const user = auth.user || null

  // Estados para o modal de senha
  const [passwordModalVisible, setPasswordModalVisible] = useState<boolean>(false)
  const [hasPassword, setHasPassword] = useState<boolean>(false)
  const [password, setPassword] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("")
  const [passwordError, setPasswordError] = useState<string>("")
  const [passwordLoading, setPasswordLoading] = useState<boolean>(false)
  const [authenticated, setAuthenticated] = useState<boolean>(false)

  const [doctorAvatar, setDoctorAvatar] = useState<string | null>(null)

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0]
  const slideAnim = useState(new Animated.Value(50))[0]

  // Verificar se o usuário já tem uma senha quando o componente é montado
  useEffect(() => {
    if (user) {
      checkExistingPassword()
    }
  }, [user])

  // Carregar conversas quando autenticado
  useEffect(() => {
    if (user && authenticated) {
      fetchConversations()
      // Add this line to fetch doctor's avatar
      if (user.id !== DOCTOR_ID) {
        fetchDoctorAvatar()
      }
    }
  }, [user, authenticated])

  // Modify the useFocusEffect hook to skip password authentication for the doctor
  useFocusEffect(
    React.useCallback(() => {
      // Resetar o estado de autenticação e mostrar o modal de senha
      setAuthenticated(false)
      setPassword("")
      setConfirmPassword("")
      setPasswordError("")

      if (user) {
        // Se for a doutora, autenticar automaticamente sem pedir senha
        if (user.id === DOCTOR_ID) {
          setAuthenticated(true)
          setPasswordModalVisible(false)
        } else {
          // Para usuários normais, verificar se tem senha e mostrar o modal
          checkExistingPassword().then(() => {
            setPasswordModalVisible(true)
          })
        }
      }

      return () => {
        // Cleanup quando a tela perde o foco
        setPasswordModalVisible(false)
      }
    }, [user]),
  )

  // Hash password using SHA-256
  const hashPassword = async (password: string) => {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password)
    return hash
  }

  // Função para salvar a senha
  const savePassword = async (password: string) => {
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
      return false
    }
  }

  // Função para verificar a senha
  const verifyPassword = async (password: string) => {
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
      return false
    }
  }

  // Atualizar a função checkExistingPassword para usar parent_password
  const checkExistingPassword = async () => {
    try {
      const user = await supabase.auth.getUser()
      if (!user.data?.user) return

      const { data, error } = await supabase
        .from("profiles")
        .select("parent_password")
        .eq("user_id", user.data.user.id)
        .single()

      if (error) throw error

      setHasPassword(!!data.parent_password)
      return !!data.parent_password
    } catch (error) {
      setHasPassword(false)
      return false
    }
  }

  // Fetch doctor's avatar
  const fetchDoctorAvatar = async () => {
    try {
      const { data, error } = await supabase.from("profiles").select("avatar_url").eq("user_id", DOCTOR_ID).single()

      if (error) throw error
      setDoctorAvatar(data?.avatar_url || null)
    } catch (error) {
      console.error("Error fetching doctor avatar:", error)
    }
  }

  // Função para lidar com o envio da senha
  const handlePasswordSubmit = async () => {
    // Validar senha
    if (!hasPassword && password !== confirmPassword) {
      setPasswordError("As senhas não coincidem")
      return
    }

    if (password.length < 4) {
      setPasswordError("A senha deve ter pelo menos 4 caracteres")
      return
    }

    setPasswordLoading(true)

    try {
      if (hasPassword) {
        // Verificar senha existente
        const isValid = await verifyPassword(password)
        if (isValid) {
          setPasswordModalVisible(false)
          setAuthenticated(true)
        } else {
          setPasswordError("Senha incorreta")
        }
      } else {
        // Criar nova senha
        const success = await savePassword(password)
        if (success) {
          setHasPassword(true)
          setPasswordModalVisible(false)
          setAuthenticated(true)
        } else {
          setPasswordError("Erro ao criar senha. Tente novamente.")
        }
      }
    } catch (error) {
      setPasswordError("Ocorreu um erro. Tente novamente.")
    } finally {
      setPasswordLoading(false)
    }
  }

  // Filtrar conversas quando a busca mudar
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredConversations(conversations)
    } else {
      const filtered = conversations.filter((conv) =>
        conv.patient_name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setFilteredConversations(filtered)
    }
  }, [searchQuery, conversations])

  const fetchConversations = async () => {
    setLoading(true)

    try {
      const currentUserId = user?.id

      if (!currentUserId) {
        setLoading(false)
        return
      }

      let chatsQuery

      // Comportamento diferente baseado no ID do usuário
      if (currentUserId === DOCTOR_ID) {
        // Doutora: buscar todos os chats
        chatsQuery = supabase
          .from("chats")
          .select("id, user_id, updated_at, last_message, unread_count_patient, unread_count_doctor")
          .order("updated_at", { ascending: false })
      } else {
        // Usuário normal: buscar apenas o chat com a doutora
        chatsQuery = supabase
          .from("chats")
          .select("id, user_id, updated_at, last_message, unread_count_patient, unread_count_doctor")
          .eq("user_id", currentUserId)
          .eq("doctor_id", DOCTOR_ID)
      }

      const { data: chats, error: chatsError } = await chatsQuery

      if (chatsError) {
        setLoading(false)
        return
      }

      // Buscar os nomes dos pacientes da tabela profiles
      const updatedConversations = await Promise.all(
        chats.map(async (chat) => {
          // Buscar o nome do paciente
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("user_id", chat.user_id)
            .single()

          return {
            id: chat.id,
            user_id: chat.user_id,
            last_message: chat.last_message || "Sem mensagens",
            updated_at: chat.updated_at,
            patient_name: profileData?.full_name || "Paciente sem nome",
            avatar_url: profileData?.avatar_url || null,
            unread_count_doctor: chat.unread_count_doctor,
            unread_count_patient: chat.unread_count_patient,
          }
        }),
      )

      setConversations(updatedConversations)
      setFilteredConversations(updatedConversations)
      setLoading(false)

      // Trigger animations after data is set
      Animated.stagger(50, [
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
      setLoading(false)
    }
  }

  const resetUnreadCount = async (chatId: string) => {
    try {
      const currentUserId = user?.id
      if (!currentUserId) return

      const columnToReset = currentUserId === DOCTOR_ID ? "unread_count_patient" : "unread_count_doctor"

      const { error } = await supabase
        .from("chats")
        .update({ [columnToReset]: 0 })
        .eq("id", chatId)
    } catch (error) {}
  }

  const renderConversationItem = ({ item, index }: { item: Conversation; index: number }) => {
    // Gerar inicial para o avatar a partir do nome do paciente
    const initial = item.patient_name.charAt(0).toUpperCase()

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          // Delay effect is handled in the animation sequence
        }}
      >
        <TouchableOpacity
          onPress={() => {
            resetUnreadCount(item.id)
            if (navigation.isFocused()) {
              navigation.navigate("chat", { chatId: item.id })
            }
          }}
          style={styles.conversationCard}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {user?.id === DOCTOR_ID ? (
                // Doctor viewing: show patient avatar
                item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                )
              ) : // Patient viewing: show doctor avatar
              doctorAvatar ? (
                <Image source={{ uri: doctorAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>D</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.conversationContent}>
            <Text style={styles.patientName}>
              {user?.id === DOCTOR_ID ? `Paciente: ${item.patient_name}` : "Dra. Ana Cavalcanti"}
            </Text>
            <Text style={styles.lastMessage} numberOfLines={1} ellipsizeMode="tail">
              {item.last_message}
            </Text>
          </View>
          {(user?.id === DOCTOR_ID ? item.unread_count_patient : item.unread_count_doctor) > 0 && (
            <View style={styles.unreadIndicator}>
              <Text style={styles.unreadCount}>
                {user?.id === DOCTOR_ID ? item.unread_count_patient : item.unread_count_doctor}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const renderEmptyComponent = () => {
    if (loading) return null

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma conversa encontrada</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchConversations}>
          <Text style={styles.refreshButtonText}>Atualizar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading && authenticated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>Carregando conversas...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Modal de senha */}
      <Modal visible={passwordModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{hasPassword ? "Digite sua senha" : "Crie uma senha"}</Text>

            {!hasPassword && <Text style={styles.modalSubtitle}>Esta senha será usada para acessar as conversas</Text>}

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

            {!hasPassword && (
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
                onPress={() => {
                  // Se o usuário cancelar, voltar para a tela anterior
                  navigation.goBack()
                  setPasswordModalVisible(false)
                }}
                disabled={passwordLoading}
              >
                <Text style={styles.modalCancelButtonText}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitButton, passwordLoading && styles.modalSubmitButtonDisabled]}
                onPress={handlePasswordSubmit}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>{hasPassword ? "Entrar" : "Criar Senha"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {authenticated && (
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Conversas</Text>
            <TouchableOpacity style={styles.refreshButton} onPress={fetchConversations}>
              <Text style={styles.refreshButtonText}>Atualizar</Text>
            </TouchableOpacity>
          </View>

          {/* Campo de busca (apenas visível para a doutora) */}
          {user?.id === DOCTOR_ID && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar paciente por nome..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          )}

          <FlatList
            data={filteredConversations}
            renderItem={renderConversationItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={renderEmptyComponent}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </SafeAreaView>
  )
}

const { width } = Dimensions.get("window")

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    padding: 16,
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  refreshButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#F163E0",
    borderRadius: 8,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    color: "#111827",
  },
  listContainer: {
    paddingBottom: 20,
  },
  conversationCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    alignItems: "center", // Ensure items are vertically aligned
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  conversationContent: {
    flex: 1, // Take up remaining space
    justifyContent: "center",
  },
  patientName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: "#6B7280",
  },
  unreadIndicator: {
    backgroundColor: "#3B82F6",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    alignSelf: "center", // Align the blue icon vertically in the row
  },
  unreadCount: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 16,
  },
  // Estilos para o modal de senha
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
})

export default DoctorChats
