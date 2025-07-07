"use client"

import type React from "react"
import { useEffect, useState, useRef, useCallback } from "react"
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Animated,
  Dimensions,
  SafeAreaView,
  Modal,
  Image,
} from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useAuth } from "../hooks/useAuth"
import { supabase } from "../services/supabase"
import * as Crypto from "expo-crypto"
import type { EmotionEntry } from "../services/diary"
import { router } from "expo-router"
import ExclusiveContentScreen from "./exclusiveContent"
import { useAlertContext } from "../components/alert-provider"
import { updateParentPoints } from "../services/diary"
import * as FileSystem from "expo-file-system"
import { useFocusEffect } from "@react-navigation/native"

// ID da doutora
const DOCTOR_ID = "b46ab255-8937-4904-9ba1-3d533027b0d9"

// Interface para os pacientes
interface Patient {
  id: string
  full_name: string
  has_entry_today: boolean
  avatar_url?: string
}

// Interface para entradas do diário com comentários dos pais
interface DiaryEntryWithComment extends EmotionEntry {
  parent_comment?: string
}

// Interface para perguntas diárias
interface DailyQuestion {
  id: string
  question: string
}

// Adicionar interface para armazenamento de perguntas diárias
interface StoredDailyQuestions {
  questions: DailyQuestion[]
  timestamp: string
}

const navigateTo = (route: string) => {
  router.push(route)
}

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
      .select("parent_password")
      .eq("user_id", user.id)
      .single()

    if (profileError) throw profileError

    return {
      email: user.email,
      has_parent_password: !!profile.parent_password,
    }
  } catch (error) {
    return {
      email: "",
      has_parent_password: false,
    }
  }
}

// Componente de filtro de período
const PeriodFilter = ({
  selectedPeriod,
  onSelectPeriod,
}: {
  selectedPeriod: string
  onSelectPeriod: (period: string) => void
}) => {
  return (
    <View style={styles.filterContainer}>
      <Text style={styles.filterLabel}>Filtrar por período:</Text>
      <View style={styles.filterOptions}>
        <TouchableOpacity
          style={[styles.filterOption, selectedPeriod === "today" && styles.filterOptionSelected]}
          onPress={() => onSelectPeriod("today")}
        >
          <Text style={[styles.filterText, selectedPeriod === "today" && styles.filterTextSelected]}>Hoje</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterOption, selectedPeriod === "week" && styles.filterOptionSelected]}
          onPress={() => onSelectPeriod("week")}
        >
          <Text style={[styles.filterText, selectedPeriod === "week" && styles.filterTextSelected]}>7 dias</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterOption, selectedPeriod === "month" && styles.filterOptionSelected]}
          onPress={() => onSelectPeriod("month")}
        >
          <Text style={[styles.filterText, selectedPeriod === "month" && styles.filterTextSelected]}>30 dias</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterOption, selectedPeriod === "all" && styles.filterOptionSelected]}
          onPress={() => onSelectPeriod("all")}
        >
          <Text style={[styles.filterText, selectedPeriod === "all" && styles.filterTextSelected]}>Todos</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// Componente de tooltip simples
const Tooltip = ({ visible, children, message }: { visible: boolean; children: React.ReactNode; message: string }) => {
  if (!visible) return children

  return (
    <View style={{ position: "relative" }}>
      {children}
      <View style={styles.tooltip}>
        <Text style={styles.tooltipText}>{message}</Text>
      </View>
    </View>
  )
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
    return false
  }
}

const ParentDiaryScreen = ({ autoShowPasswordModal = true }) => {
  const [entries, setEntries] = useState<DiaryEntryWithComment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState("week") // Default to 7 days
  const [comments, setComments] = useState<{ [key: string]: string }>({})
  const [savingComment, setSavingComment] = useState<{ [key: string]: boolean }>({})
  const { user } = useAuth()
  const { patientId } = useLocalSearchParams()
  const [showExclusiveContent, setShowExclusiveContent] = useState(false)
  const { success, error2, warning, info } = useAlertContext()
  const [savingAnswerIds, setSavingAnswerIds] = useState<string[]>([]) // Para controlar quais perguntas estão sendo salvas

  // Parent Password Modal
  const [hasParentPassword, setHasParentPassword] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showParentDiary, setShowParentDiary] = useState(false)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  const isDoctor = user?.id === DOCTOR_ID

  const [dailyQuestions, setDailyQuestions] = useState<DailyQuestion[]>([])
  const [answers, setAnswers] = useState<{ [key: string]: string }>({})
  const [savingAnswers, setSavingAnswers] = useState(false)
  const [dailyAnswers, setDailyAnswers] = useState<
    { question_id: string; question: string; answer: string; created_at: string }[]
  >([])

  // Sempre exibir o modal de senha ao acessar a página
  useFocusEffect(
    useCallback(() => {
      const checkPasswordAndShowModal = async () => {
        try {
          // Resetar estado do modal
          setPassword("");
          setConfirmPassword("");
          setPasswordError("");
          setPasswordModalVisible(true);
          setShowParentDiary(false);
        } catch (error) {
          return false
        }
      };

      checkPasswordAndShowModal();
    }, [])
  );

  // Função para obter o caminho do arquivo de perguntas diárias
  const getDailyQuestionsFilePath = (userId: string): string => {
    return `${FileSystem.documentDirectory}daily_questions_${userId}.json`
  }

  // Função para armazenar perguntas diárias usando FileSystem
  const storeDailyQuestions = async (userId: string, data: StoredDailyQuestions) => {
    try {
      const filePath = getDailyQuestionsFilePath(userId)
      const jsonString = JSON.stringify(data)

      await FileSystem.writeAsStringAsync(filePath, jsonString)
      return true
    } catch (error) {
      return false
    }
  }

  // Função para recuperar perguntas diárias armazenadas usando FileSystem
  const getStoredDailyQuestions = async (userId: string): Promise<StoredDailyQuestions | null> => {
    try {
      const filePath = getDailyQuestionsFilePath(userId)

      // Verificar se o arquivo existe
      const fileInfo = await FileSystem.getInfoAsync(filePath)

      if (!fileInfo.exists) {
        return null
      }

      const jsonString = await FileSystem.readAsStringAsync(filePath)

      return JSON.parse(jsonString)
    } catch (error) {
      return null
    }
  }

  // Função para verificar se as perguntas diárias devem ser atualizadas
  const shouldUpdateDailyQuestions = (timestamp: string): boolean => {
    const today = new Date()
    const storedDate = new Date(timestamp)

    // Verificar se é um novo dia (passou da meia-noite)
    return (
      today.getDate() !== storedDate.getDate() ||
      today.getMonth() !== storedDate.getMonth() ||
      today.getFullYear() !== storedDate.getFullYear()
    )
  }

  // Função para obter a data atual no formato YYYY-MM-DD
  const getCurrentDate = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  }

  // Fetch two random questions for parents
  const fetchDailyQuestions = async () => {
    try {
      if (!user?.id) return

      // Verificar se já temos perguntas diárias armazenadas
      const storedQuestions = await getStoredDailyQuestions(user.id)

      if (storedQuestions && !shouldUpdateDailyQuestions(storedQuestions.timestamp)) {
        setDailyQuestions(storedQuestions.questions)

        // Carregar respostas existentes para estas perguntas
        await loadExistingAnswers(storedQuestions.questions.map((q) => q.id))
        return
      }

      // Se não houver perguntas armazenadas ou se for um novo dia, busque novas
      const { data: allQuestions, error: fetchQuestionsError } = await supabase
        .from("questions_parents")
        .select("id, question")

      if (fetchQuestionsError) {
        throw fetchQuestionsError
      }

      if (allQuestions && allQuestions.length > 0) {
        const shuffled = allQuestions.sort(() => 0.5 - Math.random())
        const randomQuestions = shuffled.slice(0, 2)

        setDailyQuestions(randomQuestions)

        // Salvar as novas perguntas com timestamp
        await storeDailyQuestions(user.id, {
          questions: randomQuestions,
          timestamp: new Date().toISOString(),
        })

        // Carregar respostas existentes para estas perguntas
        await loadExistingAnswers(randomQuestions.map((q) => q.id))
      }
    } catch (error) {
      error2("Erro ao buscar perguntas diárias", "Ocorreu um erro ao buscar as perguntas diárias. Tente novamente.")
    }
  }

  // Carregar respostas existentes para as perguntas
  const loadExistingAnswers = async (questionIds: string[]) => {
    try {
      if (!user?.id) return

      const { data: existingAnswers, error } = await supabase
        .from("answers_parents")
        .select("question_id, answer")
        .eq("user_id", user.id)
        .in("question_id", questionIds)

      if (error) {
        throw error
      }

      if (existingAnswers && existingAnswers.length > 0) {
        const answersMap = existingAnswers.reduce<Record<string, string>>((acc, curr) => {
          acc[curr.question_id] = curr.answer
          return acc
        }, {})
        setAnswers(answersMap)
      }
    } catch (error) {
      error2("Erro ao carregar respostas existentes", "Ocorreu um erro ao carregar as respostas existentes. Tente novamente.")
    }
  }

  // Substitua a declaração incompleta de fetchDailyQuestionsAnswers por esta implementação completa
  const fetchDailyQuestionsAnswers = async (userId: string) => {
    try {
      if (!userId) {
        return []
      }

      // Obter a data de hoje no formato ISO (YYYY-MM-DD)
      const today = new Date().toISOString().split("T")[0]

      // Buscar respostas do usuário na tabela answers_parents para o dia atual
      const { data: answeredQuestions, error: fetchError } = await supabase
        .from("answers_parents")
        .select("question_id, answer, created_at")
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)

      if (fetchError) {
        return []
      }

      if (!answeredQuestions || answeredQuestions.length === 0) {
        // Se não houver respostas para hoje, buscar as mais recentes
        const { data: recentAnswers, error: recentError } = await supabase
          .from("answers_parents")
          .select("question_id, answer, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(2)

        if (recentError) {
          return []
        }

        if (!recentAnswers || recentAnswers.length === 0) {
          return []
        }

        const answeredQuestions = recentAnswers
      }

      // Obter as perguntas correspondentes aos question_ids
      const questionIds = answeredQuestions.map((q) => q.question_id)
      const { data: questions, error: questionsError } = await supabase
        .from("questions_parents")
        .select("id, question")
        .in("id", questionIds)

      if (questionsError) {
        return []
      }

      // Mapear perguntas e respostas para uma variável utilizável
      const questionsWithAnswers = answeredQuestions.map((answered) => {
        const question = questions?.find((q) => q.id === answered.question_id)
        return {
          question_id: answered.question_id,
          question: question?.question || "Pergunta não encontrada",
          answer: answered.answer || "",
          created_at: answered.created_at,
        }
      })

      return questionsWithAnswers
    } catch (error) {
      return []
    }
  }

  // Função para salvar uma resposta individual
  const saveAnswer = async (questionId: string, answer: string) => {
    try {
      if (!user?.id) {
        warning("Erro ao salvar resposta", "Usuário não encontrado.");
        return false;
      }

      if (!answer.trim()) {
        warning("Resposta vazia", "Por favor, digite uma resposta.");
        return false;
      }

      setSavingAnswerIds((prev) => [...prev, questionId]);

      // Verificar se já existe uma resposta para esta pergunta
      const { data: existingAnswer, error: checkError } = await supabase
        .from("answers_parents")
        .select("id, answer")
        .eq("user_id", user.id)
        .eq("question_id", questionId)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 é o código para "nenhum resultado encontrado"
        throw checkError;
      }

      if (existingAnswer) {
        // Atualizar a resposta existente
        const { error: updateError } = await supabase
          .from("answers_parents")
          .update({ answer: answer, updated_at: new Date().toISOString() })
          .eq("id", existingAnswer.id);

        if (updateError) {
          throw updateError;
        }

        success("Resposta editada com sucesso!", "Sua resposta foi atualizada.");
      } else {
        // Inserir uma nova resposta
        const { error: insertError } = await supabase.from("answers_parents").insert([
          {
            user_id: user.id,
            question_id: questionId,
            answer: answer,
            created_at: new Date().toISOString(),
          },
        ]);

        if (insertError) {
          throw insertError;
        }

        await updateParentPoints(user.id, 2);
        success("Resposta salva com sucesso!", "Parabéns! Você ganhou 2 pontos!");
      }

      return true;
    } catch (error) {
      error2("Erro ao salvar resposta", "Ocorreu um erro ao salvar sua resposta. Tente novamente.");
      return false;
    } finally {
      setSavingAnswerIds((prev) => prev.filter((id) => id !== questionId));
    }
  };

  // Save answers to the database - versão atualizada para salvar todas as respostas
  const saveAnswers = async () => {
    try {
      setSavingAnswers(true)

      if (!user?.id) {
        warning("Erro ao salvar respostas", "Usuário não encontrado.")
        return
      }

      // Verificar se há pelo menos uma resposta para salvar
      const hasAnswers = dailyQuestions.some((q) => answers[q.id]?.trim())

      if (!hasAnswers) {
        warning("Nenhuma resposta", "Por favor, responda pelo menos uma pergunta.")
        return
      }

      // Salvar cada resposta individualmente
      let savedCount = 0
      for (const question of dailyQuestions) {
        const answer = answers[question.id]
        if (answer?.trim()) {
          const success = await saveAnswer(question.id, answer)
          if (success) savedCount++
        }
      }

      if (savedCount > 0) {
        info(`${savedCount} ${savedCount === 1 ? "resposta salva" : "respostas salvas"} com sucesso!`, "")
      }
    } catch (error) {
      error2("Erro ao salvar respostas", "Ocorreu um erro ao salvar suas respostas. Tente novamente.")
    } finally {
      setSavingAnswers(false)
    }
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
        const success2 = await saveParentPassword(password)
        if (success2) {
          setHasParentPassword(true)
          setPasswordModalVisible(false)
          setShowParentDiary(true)
          success("Sucesso", "Senha criada com sucesso!")
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

  const loadProfileData = async () => {
    const data = await fetchProfileData()
    setHasParentPassword(data.has_parent_password)
  }

  useFocusEffect(
    useCallback(() => {
      const loadAllData = async () => {
        setLoading(true)
        await Promise.all([loadProfileData()])
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

  // Fetch questions on component mount
  useEffect(() => {
    fetchDailyQuestions()
  }, [user?.id])

  // Substitua o useEffect existente por este
  useEffect(() => {
    const fetchAnswers = async () => {
      if (!selectedPatientId || !isDoctor) return

      const answers = await fetchDailyQuestionsAnswers(selectedPatientId)
      setDailyAnswers(answers)
    }

    if (isDoctor && selectedPatientId) {
      fetchAnswers()
    }
  }, [selectedPatientId, isDoctor])

  // Efeito para carregar dados iniciais
  useEffect(() => {
    if (isDoctor && !patientId) {
      // Se for a doutora e não tiver um paciente selecionado, carrega a lista de pacientes
      loadPatients()
    } else {
      // Se for um paciente ou a doutora visualizando um paciente específico
      const targetUserId = (patientId as string) || user?.id
      if (targetUserId) {
        setSelectedPatientId(targetUserId)
        loadEntries(true, targetUserId)
      }
    }
  }, [user, patientId])

  // Efeito para filtrar pacientes quando a busca mudar
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPatients(patients)
    } else {
      // Filtrar por palavras completas
      const searchTerms = searchQuery
        .toLowerCase()
        .split(" ")
        .filter((term) => term.length > 0)

      const filtered = patients.filter((patient) => {
        const patientNameWords = patient.full_name.toLowerCase().split(" ")

        // Verificar se algum termo de busca corresponde ao início de alguma palavra no nome
        return searchTerms.some((term) => patientNameWords.some((word) => word.startsWith(term)))
      })

      setFilteredPatients(filtered)
    }
  }, [searchQuery, patients])

  // Efeito para recarregar entradas quando o período mudar
  useEffect(() => {
    if (selectedPatientId) {
      setPage(1)
      loadEntries(true, selectedPatientId)
    }
  }, [selectedPeriod])

  // Efeito para animar os itens quando carregados
  useEffect(() => {
    if (!loading && (entries.length > 0 || patients.length > 0)) {
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
  }, [loading, entries.length, patients.length])

  // Função para verificar se um paciente tem registro hoje
  const checkTodayEntries = async (userId: string) => {
    try {
      // Obter a data de hoje no formato ISO (YYYY-MM-DD)
      const today = new Date().toISOString().split("T")[0]

      // Buscar entradas do dia atual
      const { data, error } = await supabase
        .from("emotion_entries")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .limit(1)

      if (error) {
        throw error
      }

      // Retorna true se encontrou alguma entrada
      return data && data.length > 0
    } catch (error) {
      return false
    }
  }

  // Função para carregar a lista de pacientes
  const loadPatients = async () => {
    try {
      setLoading(true)

      // Buscar todos os perfis de pacientes
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, avatar_url").order("full_name")

      if (error) {
        throw error
      }

      // Verificar entradas do dia para cada paciente
      const patientsWithEntryStatus = await Promise.all(
        data.map(async (profile) => {
          const hasEntryToday = await checkTodayEntries(profile.user_id)

          return {
            id: profile.user_id,
            full_name: profile.full_name,
            has_entry_today: hasEntryToday,
            avatar_url: profile.avatar_url || "",
          }
        }),
      )

      setPatients(patientsWithEntryStatus)
      setFilteredPatients(patientsWithEntryStatus)
    } catch (error) {
      return false
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Função para carregar entradas do diário com comentários dos pais
  const loadEntries = async (refresh = false, userId = selectedPatientId) => {
    if (!userId) return

    try {
      setLoading(true)
      const currentPage = refresh ? 1 : page
      const limit = 10 // 10 entradas por página

      // Determinar o período de filtro
      let startDate: string | null = null

      if (selectedPeriod === "today") {
        const today = new Date().toISOString().split("T")[0]
        startDate = `${today}T00:00:00`
      } else if (selectedPeriod === "week") {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.toISOString()
      } else if (selectedPeriod === "month") {
        const monthAgo = new Date()
        monthAgo.setDate(monthAgo.getDate() - 30)
        startDate = monthAgo.toISOString()
      }

      // Construir a consulta
      let query = supabase
        .from("emotion_entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range((currentPage - 1) * limit, currentPage * limit - 1)

      // Adicionar filtro de data se necessário
      if (startDate) {
        query = query.gte("created_at", startDate)
      }

      // Executar a consulta
      const { data, error, count } = await query

      if (error) {
        throw error
      }

      // Verificar se há mais entradas
      const more = count ? count > currentPage * limit : false

      // Mapear para o formato DiaryEntryWithComment
      const entriesWithComments = data as DiaryEntryWithComment[]

      // Atualizar o estado
      setEntries(refresh ? entriesWithComments : [...entries, ...entriesWithComments])
      setHasMore(more)
      setPage(currentPage + 1)

      // Inicializar o estado dos comentários
      const newComments = { ...comments }
      entriesWithComments.forEach((entry) => {
        if (entry.parent_comment && !newComments[entry.id]) {
          newComments[entry.id] = entry.parent_comment
        }
      })
      setComments(newComments)
    } catch (error) {
      return false
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Função para salvar comentário do pai
  const saveParentComment = async (entryId: string, comment: string) => {
    try {
      setSavingComment((prev) => ({ ...prev, [entryId]: true }))

      // Verificar se o campo parent_comment é nulo
      const { data: entryData, error: entryError } = await supabase
        .from("emotion_entries")
        .select("parent_comment")
        .eq("id", entryId)
        .single()

      if (entryError) {
        throw entryError
      }

      const isCommentNull = entryData?.parent_comment === null

      const { error } = await supabase.from("emotion_entries").update({ parent_comment: comment }).eq("id", entryId)

      if (error) {
        throw error
      }

      // Atualizar a entrada localmente
      setEntries(entries.map((entry) => (entry.id === entryId ? { ...entry, parent_comment: comment } : entry)))

      if (user?.id) {
        if (isCommentNull) {
          // Se o comentário era nulo, adicionar pontos
          await updateParentPoints(user.id, 2)
          success("Comentário salvo com sucesso!", "Parabéns! Você ganhou 2 pontos!")
        } else {
          // Se o comentário já existia, apenas exibir mensagem de edição
          success("Comentário editado com sucesso!", "Seu comentário foi atualizado.")
        }
      } else {
        warning("Erro ao salvar comentário", "Usuário não encontrado.")
      }

      return true
    } catch (error) {
      error2("Erro ao salvar comentário", "Ocorreu um erro ao salvar seu comentário. Tente novamente.")
      return false
    } finally {
      setSavingComment((prev) => ({ ...prev, [entryId]: false }))
    }
  }

  // Função para atualizar a lista
  const onRefresh = async () => {
    setRefreshing(true)
    setPage(1)

    if (isDoctor && !selectedPatientId) {
      await loadPatients()
    } else {
      await loadEntries(true)
    }
  }

  // Função para carregar mais entradas ao rolar
  const loadMore = () => {
    if (hasMore && !loading && selectedPatientId) {
      loadEntries()
    }
  }

  // Função para selecionar um paciente
  const selectPatient = (patientId: string) => {
    setSelectedPatientId(patientId)
    setPage(1)
    loadEntries(true, patientId)
  }

  // Função para voltar à lista de pacientes
  const backToPatientList = () => {
    setSelectedPatientId(null)
    setEntries([])
    loadPatients()
  }

  // Funções auxiliares para exibir emoções
  const getEmotionIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      happy: "😊",
      excited: "🤗",
      sad: "😢",
      upset: "😫",
      angry: "😠",
      other: "🤔",
    }
    return icons[type] || "🤔"
  }

  const getEmotionTranslated = (type: string) => {
    const translations: { [key: string]: string } = {
      happy: "Feliz",
      excited: "Animado(a)",
      sad: "Triste",
      upset: "Chateado(a)",
      angry: "Bravo(a)",
      other: "Outro",
    }
    return translations[type] || "Outro"
  }

  const getEmotionColor = (type: string) => {
    const colors: { [key: string]: string } = {
      happy: "#4ADE80",
      excited: "#F59E0B",
      sad: "#60A5FA",
      upset: "#A78BFA",
      angry: "#EF4444",
      other: "#6B7280",
    }
    return colors[type] || "#6B7280"
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Renderizar item de paciente
  const renderPatientItem = ({ item }: { item: Patient }) => {
    // Gerar inicial para o avatar
    const initial = item.full_name.charAt(0).toUpperCase()

    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <TouchableOpacity onPress={() => selectPatient(item.id)} style={styles.patientCard} activeOpacity={0.7}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {initial}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.patientContent}>
            <Text style={styles.patientName}>Paciente: {item.full_name}</Text>
            <Text style={styles.patientSubtext}>Toque para ver o diário</Text>
          </View>

          {/* Indicador de registro diário */}
          <TouchableOpacity
            style={styles.statusContainer}
            onPress={() => setTooltipVisible(tooltipVisible === item.id ? null : item.id)}
          >
            <Tooltip
              visible={tooltipVisible === item.id}
              message={item.has_entry_today ? "Paciente registrou emoção hoje" : "Paciente não registrou emoção hoje"}
            >
              {item.has_entry_today ? (
                <View style={styles.statusIconSuccess}>
                  <Text style={styles.statusIconText}>✓</Text>
                </View>
              ) : (
                <View style={styles.statusIconError}>
                  <Text style={styles.statusIconText}>✕</Text>
                </View>
              )}
            </Tooltip>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  // Renderizar item de diário
  const renderDiaryItem = ({ item }: { item: DiaryEntryWithComment }) => {
    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.emotionContainer}>
              <Text style={styles.emotionIcon}>{getEmotionIcon(item.emotion_type)}</Text>
              <Text style={styles.emotionType}>{getEmotionTranslated(item.emotion_type)}</Text>
            </View>
            <Text style={styles.date}>{formatDate(item.created_at)}</Text>
          </View>

          <Text style={styles.description}>{item.emotion_description}</Text>

          <View style={styles.intensityContainer}>
            <Text style={styles.intensityLabel}>Intensidade</Text>
            <View style={styles.intensityBarContainer}>
              <View
                style={[
                  styles.intensityBar,
                  {
                    width: `${item.intensity}%`,
                    backgroundColor: getEmotionColor(item.emotion_type),
                  },
                ]}
              />
            </View>
            <Text style={styles.intensityValue}>{item.intensity}%</Text>
          </View>

          {/* Seção de comentário dos pais */}
          <View style={styles.commentSection}>
            <Text style={styles.commentLabel}>Comentário dos Pais:</Text>
            <TextInput
              style={styles.commentInput}
              multiline
              placeholder="Adicione um comentário sobre este registro..."
              placeholderTextColor="#9CA3AF"
              value={comments[item.id] || ""}
              onChangeText={(text) => setComments({ ...comments, [item.id]: text })}
              editable={!isDoctor} // Apenas pais podem editar
            />

            {!isDoctor && (
              <TouchableOpacity
                style={styles.commentButton}
                onPress={() => saveParentComment(item.id, comments[item.id] || "")}
                disabled={savingComment[item.id]}
              >
                {savingComment[item.id] ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.commentButtonText}>Salvar Comentário</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    )
  }

  // Tela de carregamento
  if (loading && entries.length === 0 && patients.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>{isDoctor ? "Carregando lista de pacientes..." : "Carregando diário..."}</Text>
      </View>
    )
  }

  // Tela de lista de pacientes (apenas para a doutora)
  if (isDoctor && !selectedPatientId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Acompanhamento dos Pacientes</Text>
        </View>

        {/* Campo de busca */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar paciente por nome..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <FlatList
          data={filteredPatients}
          renderItem={renderPatientItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          onEndReached={loadMore}
          onEndReachedThreshold={0.1}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nenhum paciente encontrado</Text>
              <Text style={styles.emptySubtitle}>Tente ajustar sua busca.</Text>
            </View>
          }
        />
      </SafeAreaView>
    )
  }

  if (passwordModalVisible) {
    return (
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
              setPassword(text);
              setPasswordError("");
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
                setConfirmPassword(text);
                setPasswordError("");
              }}
              placeholder="Confirme sua senha"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
            />
          )}

          {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}

          <View style={styles.modalButtons}>
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
    );
  }

  // Tela de diário (para pacientes ou doutora visualizando um paciente específico)
  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>
        {isDoctor && (
          <TouchableOpacity style={styles.backButton} onPress={backToPatientList}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Diário dos Pais</Text>
      </View>


      <ScrollView style={styles.scrollView}>
        <View style={styles.contentContainer}>
          <TouchableOpacity style={styles.exclusiveContentButton} onPress={() => setShowExclusiveContent(true)}>
            <Text style={styles.exclusiveContentButtonText}>Conteúdo Exclusivo</Text>
          </TouchableOpacity>
          <View style={styles.acompanhamentoContainer}>
            <Text style={styles.title}>Acompanhamento</Text>
            <Text style={styles.subtitle}>Acompanhe o progresso do seu filho no método Emolink</Text>
          </View>

          {/* Filtro de período */}
          <PeriodFilter selectedPeriod={selectedPeriod} onSelectPeriod={setSelectedPeriod} />

          {/* Lista de entradas do diário */}
          {entries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nenhum registro encontrado no período selecionado</Text>
              <Text style={styles.emptySubtitle}>Tente selecionar um período diferente ou verifique mais tarde.</Text>
            </View>
          ) : (
            <FlatList
              data={entries}
              renderItem={renderDiaryItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false} // Desabilitar scroll da FlatList para evitar conflito com ScrollView
              onEndReachedThreshold={0.1}
              ListFooterComponent={
                hasMore ? (
                  <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore} disabled={loading}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.loadMoreButtonText}>Carregar Mais</Text>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />
          )}

          {/* Seção de Reflexões Diárias (apenas para pais) */}
          {!isDoctor && (
            <View style={styles.reflectionSection}>
              <Text style={styles.sectionTitle}>Reflexões Diárias</Text>
              <Text style={styles.sectionDescription}>
                Responda às perguntas abaixo para registrar suas observações diárias.
              </Text>

              {dailyQuestions.map((question) => (
                <View key={question.id} style={styles.questionContainer}>
                  <Text style={styles.question}>{question.question}</Text>
                  <TextInput
                    style={styles.questionInput}
                    multiline
                    placeholder="Digite sua resposta..."
                    placeholderTextColor="#9CA3AF"
                    value={answers[question.id] || ""}
                    onChangeText={(text) => setAnswers({ ...answers, [question.id]: text })}
                  />
                  <TouchableOpacity
                    style={[
                      styles.saveQuestionButton,
                      savingAnswerIds.includes(question.id) && styles.saveButtonDisabled,
                    ]}
                    onPress={() => saveAnswer(question.id, answers[question.id] || "")}
                    disabled={savingAnswerIds.includes(question.id)}
                  >
                    {savingAnswerIds.includes(question.id) ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.saveButtonText}>Salvar Resposta</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.saveButton} onPress={saveAnswers} disabled={savingAnswers}>
                {savingAnswers ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Salvar Todas as Respostas</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Substitua a seção de reflexões diárias da doutora por esta versão melhorada */}
          {isDoctor && selectedPatientId && (
            <View style={styles.reflectionSection}>
              <Text style={styles.sectionTitle}>Reflexões Diárias dos Pais</Text>
              <Text style={styles.sectionDescription}>Respostas dos pais às perguntas de reflexão diária.</Text>

              {dailyAnswers.length === 0 ? (
                <View style={styles.emptyAnswersContainer}>
                  <Text style={styles.emptyAnswersText}>Nenhuma pergunta respondida pelos pais.</Text>
                </View>
              ) : (
                <>
                  {dailyAnswers.map((item, index) => (
                    <View key={item.question_id} style={styles.questionContainer}>
                      <Text style={styles.question}>{item.question}</Text>
                      <View style={styles.answerContainer}>
                        <Text style={styles.answerText}>{item.answer ? item.answer : "Sem resposta"}</Text>
                      </View>
                      {index === 0 && (
                        <Text style={styles.answerDate}>
                          Respondido em: {new Date(item.created_at).toLocaleDateString("pt-BR")}
                        </Text>
                      )}
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
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
      {/* Modal de Conteúdo Exclusivo */}
      <Modal visible={showExclusiveContent} animationType="slide" onRequestClose={() => setShowExclusiveContent(false)}>
        <ExclusiveContentScreen onClose={() => setShowExclusiveContent(false)} />
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    flex: 1,
    textAlign: "center",
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
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: "#F163E0",
    fontWeight: "600",
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 24,
    textAlign: "center",
  },
  searchContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  searchInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    color: "#111827",
  },
  filterContainer: {
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  acompanhamentoContainer: {
    marginBottom: 20,
    paddingTop: 10,
    paddingLeft: 10,
    paddingRight: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  filterOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  filterOptionSelected: {
    backgroundColor: "#F163E0",
    borderColor: "#F163E0",
  },
  filterText: {
    fontSize: 14,
    color: "#4B5563",
  },
  filterTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
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
  patientCard: {
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
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  patientContent: {
    flex: 1,
    justifyContent: "center",
  },
  patientName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  patientSubtext: {
    fontSize: 14,
    color: "#6B7280",
  },
  statusContainer: {
    marginLeft: 8,
    position: "relative",
  },
  statusIconSuccess: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#4ADE80",
    justifyContent: "center",
    alignItems: "center",
  },
  statusIconError: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  statusIconText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  tooltip: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    padding: 8,
    borderRadius: 4,
    width: 200,
    top: -40,
    right: -88,
    zIndex: 100,
  },
  tooltipText: {
    color: "#FFFFFF",
    fontSize: 12,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  emotionContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  emotionIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  emotionType: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    textTransform: "capitalize",
  },
  date: {
    fontSize: 14,
    color: "#6B7280",
  },
  description: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 16,
    lineHeight: 22,
  },
  intensityContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  intensityLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  intensityBarContainer: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  intensityBar: {
    height: "100%",
    borderRadius: 4,
  },
  intensityValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "right",
  },
  commentSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 16,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 80,
    textAlignVertical: "top",
  },
  commentButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  commentButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginBottom: 24,
    textAlign: "center",
  },
  loadMoreButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  loadMoreButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  reflectionSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 20,
  },
  questionContainer: {
    marginBottom: 20,
    position: "relative",
  },
  question: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  questionInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  saveQuestionButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  saveButtonDisabled: {
    backgroundColor: "#F8BBF0",
  },
  emptyAnswersContainer: {
    padding: 20,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyAnswersText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  answerContainer: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 20,
  },
  answerDate: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
    marginBottom: 8,
  },
  exclusiveContentButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  exclusiveContentButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#FFFFFF", // Fundo branco
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

export default ParentDiaryScreen
