"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Modal,
} from "react-native"
import { router, useNavigation } from "expo-router"
import { authService } from "../../services/auth"
import { supabase } from "../../services/supabase"
import { useAlertContext } from "../../components/alert-provider"

// ID da doutora
const DOCTOR_ID = "b46ab255-8937-4904-9ba1-3d533027b0d9"
const WELCOME_MESSAGE = "Olá, como você está?"

// Opções de faixa etária com ícones
const AGE_GROUPS = [
  { value: "4 - 6", label: "4 - 6 anos", icon: "🧸" },
  { value: "7 - 9", label: "7 - 9 anos", icon: "🎨" },
  { value: "10 - 12", label: "10 - 12 anos", icon: "📚" },
  { value: "13 - 15", label: "13 - 15 anos", icon: "🎮" },
]

// Componente de seleção de gênero
const GenderSelector: React.FC<{ selectedGender: string; onSelect: (gender: string) => void }> = ({
  selectedGender,
  onSelect,
}) => {
  return (
    <View style={styles.genderContainer}>
      <TouchableOpacity
        style={[styles.genderOption, selectedGender === "male" && styles.genderOptionSelected]}
        onPress={() => onSelect("male")}
      >
        <Text style={[styles.genderText, selectedGender === "male" && styles.genderTextSelected]}>Masculino</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.genderOption, selectedGender === "female" && styles.genderOptionSelected]}
        onPress={() => onSelect("female")}
      >
        <Text style={[styles.genderText, selectedGender === "female" && styles.genderTextSelected]}>Feminino</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.genderOption, selectedGender === "other" && styles.genderOptionSelected]}
        onPress={() => onSelect("other")}
      >
        <Text style={[styles.genderText, selectedGender === "other" && styles.genderTextSelected]}>Outro</Text>
      </TouchableOpacity>
    </View>
  )
}

// Componente dropdown para seleção de faixa etária
const AgeGroupDropdown: React.FC<{ selectedAgeGroup: string; onSelect: (ageGroup: string) => void }> = ({
  selectedAgeGroup,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const selectedOption = AGE_GROUPS.find((group) => group.value === selectedAgeGroup)

  const handleSelect = (value: string) => {
    onSelect(value)
    setIsOpen(false)
  }

  return (
    <View style={styles.dropdownContainer}>
      <TouchableOpacity style={styles.dropdownButton} onPress={() => setIsOpen(true)}>
        <View style={styles.dropdownButtonContent}>
          {selectedOption ? (
            <>
              <Text style={styles.dropdownIcon}>{selectedOption.icon}</Text>
              <Text style={styles.dropdownSelectedText}>{selectedOption.label}</Text>
            </>
          ) : (
            <Text style={styles.dropdownPlaceholder}>Selecione a faixa etária</Text>
          )}
        </View>
        <Text style={styles.dropdownArrow}>{isOpen ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsOpen(false)}>
          <View style={styles.dropdownModal}>
            <View style={styles.dropdownList}>
              <Text style={styles.dropdownTitle}>Selecione a faixa etária</Text>
              {AGE_GROUPS.map((group) => (
                <TouchableOpacity
                  key={group.value}
                  style={[styles.dropdownOption, selectedAgeGroup === group.value && styles.dropdownOptionSelected]}
                  onPress={() => handleSelect(group.value)}
                >
                  <Text style={styles.dropdownOptionIcon}>{group.icon}</Text>
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      selectedAgeGroup === group.value && styles.dropdownOptionTextSelected,
                    ]}
                  >
                    {group.label}
                  </Text>
                  {selectedAgeGroup === group.value && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

export default function SignUp() {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [gender, setGender] = useState("")
  const [ageGroup, setAgeGroup] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { error2 } = useAlertContext()

  const navigation = useNavigation()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  // Corrigir o problema do título
  useEffect(() => {
    // Remover o título da rota
    navigation.setOptions({
      headerShown: false,
    })
  }, [navigation])

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
  }, [])

  // Função para criar registro na tabela users (sem senha)
  const createUserRecord = async (userId: string) => {
    try {
      const { error } = await supabase.from("users").insert([
        {
          id: userId,
          email: email,
          created_at: new Date().toISOString(),
        },
      ])

      if (error) {
        error2("Erro!", "Erro ao criar registro de usuário.")
      }
    } catch (error) {
      error2("Erro!", "Erro ao criar registro de usuário.")
    }
  }

  // Função para criar perfil do usuário
  const createUserProfile = async (userId: string) => {
    try {
      const { error } = await supabase.from("profiles").insert([
        {
          user_id: userId,
          full_name: fullName,
          gender: gender,
          age_group: ageGroup,
        },
      ])

      if (error) {
        error2("Erro!", "Erro ao criar perfil de usuário.")
      }
    } catch (error) {
      error2("Erro!", "Erro ao criar perfil de usuário.")
    }
  }

  // Função para criar chat com a doutora
  const createDoctorChat = async (userId: string) => {
    try {
      // 1. Criar o chat
      const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .insert([
          {
            user_id: userId,
            doctor_id: DOCTOR_ID,
            last_message: WELCOME_MESSAGE,
          },
        ])
        .select()

      if (chatError || !chatData || chatData.length === 0) {
        error2("Erro!", "Erro ao criar chat com a doutora.")
      }

      // 2. Obter o ID do chat criado
      const chatId = chatData && chatData.length > 0 ? chatData[0].id : null

      if (!chatId) {
        error2("Erro!", "Erro ao obter o ID do chat criado.")
      }

      // 3. Criar a primeira mensagem
      const { error: messageError } = await supabase.from("messages").insert([
        {
          chat_id: chatId,
          sender_id: DOCTOR_ID,
          content: WELCOME_MESSAGE,
        },
      ])

      if (messageError) {
        error2("Erro!", "Erro ao criar primeira mensagem.")
      }
    } catch (error) {
      error2("Erro!", "Erro ao configurar chat com a doutora.")
    }
  }

  const handleSignUp = async () => {
    // Validação básica
    if (!email.trim()) {
      setError("Preencha o campo de email!")
      return
    }

    if (!fullName.trim()) {
      setError("Preencha o campo de nome completo!")
      return
    }

    if (!gender) {
      setError("Selecione seu gênero!")
      return
    }

    if (!ageGroup) {
      setError("Selecione sua faixa etária!")
      return
    }

    if (!password.trim()) {
      setError("Preencha o campo de senha!")
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres!")
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem!")
      return
    }

    try {
      setLoading(true)
      setError("")

      // 1. Criar o usuário no sistema de autenticação (sem hash)
      const { user, session } = await authService.signUp(email, password)

      if (!user) {
        throw new Error("Erro ao criar o usuário. Verifique os dados fornecidos.")
      }

      // 2. Obter o ID do usuário recém-criado
      const userId = user.id

      // 3. Criar registro na tabela users (sem senha)
      await createUserRecord(userId)

      // 4. Criar o perfil do usuário na tabela profiles
      await createUserProfile(userId)

      // 5. Criar chat com a doutora e a primeira mensagem
      await createDoctorChat(userId)

      // 6. Redirecionar para a tela principal
      router.replace("/(tabs)/home")
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro ao criar a conta!")

      // Se o usuário foi criado mas houve falha em alguma etapa, tentar fazer logout
      try {
        await authService.signOut()
      } catch (logoutErr) {}
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoid}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <Animated.View
              style={[
                styles.formContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.title}>Criar Conta</Text>
              <Text style={styles.subtitle}>Cadastre-se para registrar suas emoções diariamente!</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text)
                    setError("") // Clear error when user types
                  }}
                  placeholder="Informe seu e-mail"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nome Completo</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text)
                    setError("") // Clear error when user types
                  }}
                  placeholder="Informe seu nome completo"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Gênero</Text>
                <GenderSelector selectedGender={gender} onSelect={setGender} />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Faixa Etária</Text>
                <AgeGroupDropdown selectedAgeGroup={ageGroup} onSelect={setAgeGroup} />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Senha</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text)
                    setError("") // Clear error when user types
                  }}
                  placeholder="Crie uma senha..."
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirmar Senha</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text)
                    setError("") // Clear error when user types
                  }}
                  placeholder="Digite novamente sua senha..."
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                />
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.signUpButtonText}>Criar Conta</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.signInLink} onPress={() => router.push("/sign-in")} disabled={loading}>
                <Text style={styles.signInLinkText}>
                  Já possui uma conta? <Text style={styles.signInLinkTextBold}>Faça Login</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
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
  // Estilos para o seletor de gênero
  genderContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  genderOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  genderOptionSelected: {
    backgroundColor: "#EEF2FF",
    borderColor: "#6366F1",
  },
  genderText: {
    fontSize: 14,
    color: "#4B5563",
  },
  genderTextSelected: {
    color: "#6366F1",
    fontWeight: "600",
  },
  // Estilos para o dropdown de faixa etária
  dropdownContainer: {
    position: "relative",
  },
  dropdownButton: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dropdownIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  dropdownSelectedText: {
    fontSize: 16,
    color: "#111827",
  },
  dropdownPlaceholder: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  dropdownArrow: {
    fontSize: 12,
    color: "#6B7280",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    margin: 20,
    maxWidth: 300,
    width: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownList: {
    padding: 16,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginBottom: 16,
  },
  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  dropdownOptionSelected: {
    backgroundColor: "#F3E8FF",
  },
  dropdownOptionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  dropdownOptionText: {
    fontSize: 16,
    color: "#374151",
    flex: 1,
  },
  dropdownOptionTextSelected: {
    color: "#7C3AED",
    fontWeight: "600",
  },
  checkmark: {
    fontSize: 16,
    color: "#7C3AED",
    fontWeight: "bold",
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#B91C1C",
  },
  signUpButton: {
    backgroundColor: "#F163E0",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  signUpButtonDisabled: {
    backgroundColor: "#ED77DF",
  },
  signUpButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  signInLink: {
    alignItems: "center",
  },
  signInLinkText: {
    fontSize: 14,
    color: "#6B7280",
  },
  signInLinkTextBold: {
    fontWeight: "600",
    color: "#F163E0",
  },
})
