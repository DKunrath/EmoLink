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
} from "react-native"
import { router, useNavigation } from "expo-router"
import { authService } from "../../services/auth"
import { supabase } from "../../services/supabase"

// ID da doutora
const DOCTOR_ID = "b46ab255-8937-4904-9ba1-3d533027b0d9"
const WELCOME_MESSAGE = "Olá, como você está?"

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

const AgeGroupSelector: React.FC<{ selectedAgeGroup: string; onSelect: (ageGroup: string) => void }> = ({
  selectedAgeGroup,
  onSelect,
}) => {
  return (
    <View style={styles.genderContainer}>
      <TouchableOpacity
        style={[styles.genderOption, selectedAgeGroup === "05 - 10" && styles.genderOptionSelected]}
        onPress={() => onSelect("05 - 10")}
      >
        <Text style={[styles.genderText, selectedAgeGroup === "05 - 10" && styles.genderTextSelected]}>05 - 10</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.genderOption, selectedAgeGroup === "11 - 17" && styles.genderOptionSelected]}
        onPress={() => onSelect("female")}
      >
        <Text style={[styles.genderText, selectedAgeGroup === "11 - 17" && styles.genderTextSelected]}>11 - 17</Text>
      </TouchableOpacity>
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
        console.error("Erro ao criar registro de usuário:", error)
        throw new Error("Erro ao criar registro de usuário")
      }
    } catch (error) {
      console.error("Erro ao criar registro de usuário:", error)
      throw new Error("Erro ao criar registro de usuário")
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
        console.error("Erro ao criar perfil:", error)
        throw new Error("Erro ao criar perfil de usuário")
      }
    } catch (error) {
      console.error("Erro ao criar perfil:", error)
      throw new Error("Erro ao criar perfil de usuário")
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
        console.error("Erro ao criar chat com a doutora:", chatError)
        throw new Error("Erro ao criar chat com a doutora")
      }

      // 2. Obter o ID do chat criado
      const chatId = chatData[0].id

      // 3. Criar a primeira mensagem
      const { error: messageError } = await supabase.from("messages").insert([
        {
          chat_id: chatId,
          sender_id: DOCTOR_ID,
          content: WELCOME_MESSAGE,
        },
      ])

      if (messageError) {
        console.error("Erro ao criar primeira mensagem:", messageError)
        throw new Error("Erro ao criar primeira mensagem")
      }

      console.log("Chat e primeira mensagem criados com sucesso!")
    } catch (error) {
      console.error("Erro ao configurar chat com a doutora:", error)
      throw new Error("Erro ao configurar chat com a doutora")
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
      console.error("Erro detalhado:", err)

      // Se o usuário foi criado mas houve falha em alguma etapa, tentar fazer logout
      try {
        await authService.signOut()
      } catch (logoutErr) {
        console.error("Erro ao fazer logout após falha:", logoutErr)
      }
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
                <AgeGroupSelector selectedAgeGroup={ageGroup} onSelect={setAgeGroup} />
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

