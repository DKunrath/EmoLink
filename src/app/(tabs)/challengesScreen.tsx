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
  Modal,
  TextInput,
  Switch,
  Alert,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { supabase } from "../../services/supabase"
import { useAuth } from "../../hooks/useAuth"
import { router } from "expo-router"
import * as FileSystem from "expo-file-system"

// Interface para os desafios
interface Challenge {
  id: string
  challenge_id: string
  challenge_title: string
  challenge_text: string
  challenge_type: "daily" | "weekly"
  challenge_character: string
  created_at: string
  allows_drawing: boolean
  completed?: boolean
}

// Adicionar interface para respostas de desafios
interface ChallengeResponse {
  id: string
  user_id: string
  challenge_id: string
  completed_at: string
  answer?: string
  drawing_url?: string
  challenge_title?: string
  user_name?: string
}

// Interface para os desafios completados
interface CompletedChallenge {
  id: string
  user_id: string
  challenge_id: string
  completed_at: string
  response_text?: string
  drawing_url?: string
}

// Interface para o armazenamento de desafios
interface StoredChallenges {
  challenges: Challenge[]
  timestamp: string
}

// Adicionar constante para ID da doutora
const DOCTOR_ID = "b46ab255-8937-4904-9ba1-3d533027b0d9"

const ChallengesScreen = () => {
  const [dailyChallenges, setDailyChallenges] = useState<Challenge[]>([])
  const [weeklyChallenges, setWeeklyChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [completedChallengeIds, setCompletedChallengeIds] = useState<string[]>([])
  const auth = useAuth()
  const user: { id: string } | null = auth?.user as { id: string } | null
  const navigation = useNavigation()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  const [isDoctor, setIsDoctor] = useState(false)
  const [allDailyChallenges, setAllDailyChallenges] = useState<Challenge[]>([])
  const [allWeeklyChallenges, setAllWeeklyChallenges] = useState<Challenge[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [challengeTitle, setChallengeTitle] = useState("")
  const [challengeText, setChallengeText] = useState("")
  const [challengeType, setChallengeType] = useState<"daily" | "weekly">("daily")
  const [challengeCharacter, setChallengeCharacter] = useState("Amy")
  const [allowsDrawing, setAllowsDrawing] = useState(false)
  const [responsesModalVisible, setResponsesModalVisible] = useState(false)
  const [challengeResponses, setChallengeResponses] = useState<ChallengeResponse[]>([])
  const [responsesPage, setResponsesPage] = useState(1)
  const [hasMoreResponses, setHasMoreResponses] = useState(true)
  const [responsesPeriod, setResponsesPeriod] = useState("all")
  const [patientSearchQuery, setPatientSearchQuery] = useState("")
  const [loadingResponses, setLoadingResponses] = useState(false)
  // Modificar os estados para incluir um modo de visualização no modal de respostas
  const [viewingDrawing, setViewingDrawing] = useState(false)
  const [currentDrawingUrl, setCurrentDrawingUrl] = useState("")

  // Novos estados para filtros de pesquisa
  const [dailySearchQuery, setDailySearchQuery] = useState("")
  const [weeklySearchQuery, setWeeklySearchQuery] = useState("")
  const [filteredDailyChallenges, setFilteredDailyChallenges] = useState<Challenge[]>([])
  const [filteredWeeklyChallenges, setFilteredWeeklyChallenges] = useState<Challenge[]>([])

  // Obter dimensões da tela para ajustar o tamanho do modal
  const windowWidth = Dimensions.get("window").width
  const windowHeight = Dimensions.get("window").height

  // Adicionar novos estados para armazenar todas as respostas e implementar filtragem em tempo real
  const [allChallengeResponses, setAllChallengeResponses] = useState<ChallengeResponse[]>([])

  useEffect(() => {
    if (user) {
      setIsDoctor(user.id === DOCTOR_ID)
      fetchChallenges()
    } else {
      // Se o usuário ainda não estiver carregado, configurar um intervalo para verificar
      // const checkAuthInterval = setInterval(() => {
      //   if (user) {
      //     setIsDoctor(user.id === DOCTOR_ID)
      //     fetchChallenges()
      //     clearInterval(checkAuthInterval)
      //   }
      // }, 500)
      // // Limpar o intervalo quando o componente for desmontado
      // return () => clearInterval(checkAuthInterval)
    }
  }, [user])

  // Efeito para filtrar desafios diários quando a pesquisa mudar
  useEffect(() => {
    if (allDailyChallenges.length > 0) {
      const query = dailySearchQuery.toLowerCase().trim()
      if (query === "") {
        setFilteredDailyChallenges(allDailyChallenges)
      } else {
        const filtered = allDailyChallenges.filter((challenge) =>
          challenge.challenge_title.toLowerCase().includes(query),
        )
        setFilteredDailyChallenges(filtered)
      }
    }
  }, [dailySearchQuery, allDailyChallenges])

  // Efeito para filtrar desafios semanais quando a pesquisa mudar
  useEffect(() => {
    if (allWeeklyChallenges.length > 0) {
      const query = weeklySearchQuery.toLowerCase().trim()
      if (query === "") {
        setFilteredWeeklyChallenges(allWeeklyChallenges)
      } else {
        const filtered = allWeeklyChallenges.filter((challenge) =>
          challenge.challenge_title.toLowerCase().includes(query),
        )
        setFilteredWeeklyChallenges(filtered)
      }
    }
  }, [weeklySearchQuery, allWeeklyChallenges])

  // Função para buscar desafios
  const fetchChallenges = async () => {
    try {
      setLoading(true)

      if (!user) {
        console.log("Usuário ainda não carregado, tentando novamente em breve...")
        setTimeout(fetchChallenges, 1000) // Tentar novamente em 1 segundo
        return
      }

      // Verificar se é a doutora
      const userIsDoctor = user.id === DOCTOR_ID

      // 1. Buscar desafios já completados pelo usuário (apenas para pacientes)
      if (!userIsDoctor) {
        const { data: completedChallenges, error: completedError } = await supabase
          .from("completed_challenges")
          .select("challenge_id")
          .eq("user_id", user.id)

        if (completedError) {
          throw completedError
        }

        const completedIds = completedChallenges?.map((c) => c.challenge_id) || []
        setCompletedChallengeIds(completedIds)
      }

      if (userIsDoctor) {
        // Para a doutora, buscar e mostrar todos os desafios
        await loadAllChallengesForDoctor()
      } else {
        // Para pacientes, carregar desafios diários e semanais com lógica específica
        await loadDailyChallenges(completedChallengeIds)
        await loadWeeklyChallenges(completedChallengeIds)
      }

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
      console.error("Erro ao buscar desafios:", error)
      // Tratar o erro silenciosamente sem mostrar o alerta
      console.log("Continuando a carregar os desafios disponíveis...")

      // Garantir que pelo menos alguns desafios sejam exibidos mesmo com erro
      if (dailyChallenges.length === 0) {
        setDailyChallenges([])
      }
      if (weeklyChallenges.length === 0) {
        setWeeklyChallenges([])
      }
    } finally {
      setLoading(false)
    }
  }

  // Função para carregar todos os desafios para a doutora
  const loadAllChallengesForDoctor = async () => {
    try {
      // Buscar desafios diários
      const { data: dailyData, error: dailyError } = await supabase
        .from("challenges")
        .select("*")
        .eq("challenge_type", "daily")
        .order("created_at", { ascending: false })

      if (dailyError) {
        throw dailyError
      }

      // Buscar desafios semanais
      const { data: weeklyData, error: weeklyError } = await supabase
        .from("challenges")
        .select("*")
        .eq("challenge_type", "weekly")
        .order("created_at", { ascending: false })

      if (weeklyError) {
        throw weeklyError
      }

      setAllDailyChallenges(dailyData || [])
      setFilteredDailyChallenges(dailyData || [])

      setAllWeeklyChallenges(weeklyData || [])
      setFilteredWeeklyChallenges(weeklyData || [])
    } catch (error) {
      console.error("Erro ao carregar desafios para a doutora:", error)
      throw error
    }
  }

  // Função para carregar desafios diários
  const loadDailyChallenges = async (completedIds: string[]) => {
    try {
      // Verificar se já temos desafios diários armazenados
      const storedDailyChallenges = await getStoredDailyChallenges()

      if (!storedDailyChallenges || shouldUpdateDailyChallenges(storedDailyChallenges.timestamp)) {
        console.log("Sorteando novos desafios diários...")

        // Buscar todos os desafios diários
        const { data: allDailyData, error: dailyError } = await supabase
          .from("challenges")
          .select("*")
          .eq("challenge_type", "daily")
          .order("created_at", { ascending: false })

        if (dailyError) {
          throw dailyError
        }

        // Selecionar 2 desafios diários aleatórios
        const randomDailyChallenges = getRandomChallenges(allDailyData || [], 2)

        // Salvar os desafios diários com timestamp
        await storeDailyChallenges({
          challenges: randomDailyChallenges,
          timestamp: new Date().toISOString(),
        })

        // Filtrar os desafios completados
        const filteredDailyChallenges = randomDailyChallenges.filter(
          (challenge) => !completedIds.includes(challenge.challenge_id),
        )

        setDailyChallenges(filteredDailyChallenges)
      } else {
        console.log("Usando desafios diários armazenados...")

        // Filtrar os desafios completados
        const filteredDailyChallenges = storedDailyChallenges.challenges.filter(
          (challenge) => !completedIds.includes(challenge.challenge_id),
        )

        setDailyChallenges(filteredDailyChallenges)
      }
    } catch (error) {
      console.error("Erro ao carregar desafios diários:", error)
      setDailyChallenges([])
    }
  }

  // Função para carregar desafios semanais
  const loadWeeklyChallenges = async (completedIds: string[]) => {
    try {
      // Verificar se é segunda-feira
      const today = new Date()
      const isMonday = today.getDay() === 1

      // Verificar se já temos desafios semanais armazenados
      const storedWeeklyChallenges = await getStoredWeeklyChallenges()

      if (!storedWeeklyChallenges || (isMonday && shouldUpdateWeeklyChallenges(storedWeeklyChallenges.timestamp))) {
        console.log("Sorteando novos desafios semanais...")

        // Buscar todos os desafios semanais
        const { data: allWeeklyData, error: weeklyError } = await supabase
          .from("challenges")
          .select("*")
          .eq("challenge_type", "weekly")
          .order("created_at", { ascending: false })

        if (weeklyError) {
          throw weeklyError
        }

        // Selecionar 3 desafios semanais aleatórios
        const randomWeeklyChallenges = getRandomChallenges(allWeeklyData || [], 3)

        // Salvar os desafios semanais com timestamp
        await storeWeeklyChallenges({
          challenges: randomWeeklyChallenges,
          timestamp: new Date().toISOString(),
        })

        // Filtrar os desafios completados
        const filteredWeeklyChallenges = randomWeeklyChallenges.filter(
          (challenge) => !completedIds.includes(challenge.challenge_id),
        )

        setWeeklyChallenges(filteredWeeklyChallenges)
      } else {
        console.log("Usando desafios semanais armazenados...")

        // Filtrar os desafios completados
        const filteredWeeklyChallenges = storedWeeklyChallenges.challenges.filter(
          (challenge) => !completedIds.includes(challenge.challenge_id),
        )

        setWeeklyChallenges(filteredWeeklyChallenges)
      }
    } catch (error) {
      console.error("Erro ao carregar desafios semanais:", error)
      setWeeklyChallenges([])
    }
  }

  // Modificar a função fetchChallengeResponses para armazenar todas as respostas e aplicar filtros
  const fetchChallengeResponses = async (resetPage = false, period = responsesPeriod) => {
    if (!user || user.id !== DOCTOR_ID) return

    try {
      setLoadingResponses(true)
      const page = resetPage ? 1 : responsesPage
      const limit = 15 // 15 respostas por página

      // Determinar o período de filtro
      let startDate: string | null = null

      if (period === "today") {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        startDate = today.toISOString()
        console.log("Filtrando por hoje:", startDate)
      } else if (period === "week") {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.toISOString()
        console.log("Filtrando pelos últimos 7 dias:", startDate)
      } else if (period === "month") {
        const monthAgo = new Date()
        monthAgo.setDate(monthAgo.getDate() - 30)
        startDate = monthAgo.toISOString()
        console.log("Filtrando pelos últimos 30 dias:", startDate)
      } else {
        console.log("Filtrando por todos os períodos")
      }

      // Construir a consulta base
      let query = supabase
        .from("completed_challenges")
        .select(`
        id, 
        user_id, 
        challenge_id, 
        completed_at, 
        answer, 
        drawing_url,
        challenges(challenge_title)
      `)
        .order("completed_at", { ascending: false })

      // Adicionar filtro de data se necessário
      if (startDate) {
        query = query.gte("completed_at", startDate)
      }

      // Adicionar paginação
      query = query.range((page - 1) * limit, page * limit - 1)

      const { data, error } = await query

      if (error) {
        throw error
      }

      // Buscar nomes dos usuários
      const userIds = data?.map((item) => item.user_id) || []
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds)

      if (profilesError) {
        throw profilesError
      }

      // Mapear os nomes dos usuários para as respostas
      const responsesWithNames =
        data?.map((item) => {
          const profile = profilesData?.find((p) => p.user_id === item.user_id)
          return {
            id: item.id,
            user_id: item.user_id,
            challenge_id: item.challenge_id,
            completed_at: item.completed_at,
            answer: item.answer,
            drawing_url: item.drawing_url,
            challenge_title:
              item.challenges && !Array.isArray(item.challenges)
                ? (item.challenges as { challenge_title: string }).challenge_title
                : "Desafio sem título",
            user_name: profile?.full_name || "Usuário desconhecido",
          }
        }) || []

      // Verificar se há mais respostas
      const hasMore = data && data.length === limit

      if (resetPage) {
        setAllChallengeResponses(responsesWithNames)
        applyResponseFilters(responsesWithNames, patientSearchQuery, period)
      } else {
        const updatedResponses = [...allChallengeResponses, ...responsesWithNames]
        setAllChallengeResponses(updatedResponses)
        applyResponseFilters(updatedResponses, patientSearchQuery, period)
      }

      setResponsesPage(page + 1)
      setHasMoreResponses(hasMore)
    } catch (error) {
      console.error("Erro ao buscar respostas de desafios:", error)
      Alert.alert("Erro", "Não foi possível carregar as respostas dos desafios.")
    } finally {
      setLoadingResponses(false)
    }
  }

  // Adicionar função para aplicar filtros às respostas
  const applyResponseFilters = (responses: ChallengeResponse[], searchQuery: string, period: string) => {
    // Primeiro, filtrar por período se necessário
    let filteredByPeriod = responses

    if (period !== "all") {
      const now = new Date()
      let startDate: Date

      if (period === "today") {
        startDate = new Date(now)
        startDate.setHours(0, 0, 0, 0)
      } else if (period === "week") {
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
      } else if (period === "month") {
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 30)
      } else {
        startDate = new Date(0) // Data muito antiga para incluir tudo
      }

      filteredByPeriod = responses.filter((item) => {
        const itemDate = new Date(item.completed_at)
        return itemDate >= startDate
      })
    }

    // Depois, filtrar por nome do paciente se houver busca
    if (searchQuery.trim()) {
      const filtered = filteredByPeriod.filter((item) =>
        (item.user_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
      setChallengeResponses(filtered)
    } else {
      setChallengeResponses(filteredByPeriod)
    }
  }

  // Adicionar função para resetar o formulário de desafio
  const resetChallengeForm = () => {
    setEditingChallenge(null)
    setChallengeTitle("")
    setChallengeText("")
    setChallengeType("daily")
    setChallengeCharacter("Amy")
    setAllowsDrawing(false)
  }

  // Adicionar função para abrir o modal de edição
  const openEditModal = (challenge: Challenge) => {
    setEditingChallenge(challenge)
    setChallengeTitle(challenge.challenge_title)
    setChallengeText(challenge.challenge_text)
    setChallengeType(challenge.challenge_type)
    setChallengeCharacter(challenge.challenge_character)
    setAllowsDrawing(challenge.allows_drawing)
    setModalVisible(true)
  }

  // Adicionar função para abrir o modal de criação
  const openCreateModal = () => {
    resetChallengeForm()
    setModalVisible(true)
  }

  // Modificar a função saveChallenge para atualizar os desafios armazenados
  const saveChallenge = async () => {
    if (!challengeTitle.trim() || !challengeText.trim()) {
      Alert.alert("Erro", "Por favor, preencha todos os campos obrigatórios.")
      return
    }

    try {
      setLoading(true)

      const challengeData = {
        challenge_title: challengeTitle,
        challenge_text: challengeText,
        challenge_type: challengeType,
        challenge_character: challengeCharacter,
        allows_drawing: allowsDrawing,
      }

      if (editingChallenge) {
        // Atualizar desafio existente
        const { error } = await supabase
          .from("challenges")
          .update(challengeData)
          .eq("challenge_id", editingChallenge.challenge_id)

        if (error) throw error

        // Atualizar o desafio nos arquivos locais de todos os pacientes
        await updateChallengeInLocalStorage(editingChallenge.challenge_id, {
          ...editingChallenge,
          ...challengeData,
        })

        Alert.alert("Sucesso", "Desafio atualizado com sucesso!")
      } else {
        // Criar novo desafio
        const { error } = await supabase.from("challenges").insert([
          {
            ...challengeData,
          },
        ])

        if (error) throw error

        Alert.alert("Sucesso", "Desafio criado com sucesso!")
      }

      setModalVisible(false)
      resetChallengeForm()
      fetchChallenges() // Recarregar a lista de desafios
    } catch (error) {
      console.error("Erro ao salvar desafio:", error)
      Alert.alert("Erro", "Não foi possível salvar o desafio. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  // Adicionar função para atualizar um desafio nos arquivos locais
  const updateChallengeInLocalStorage = async (challengeId: string, updatedChallenge: Challenge) => {
    try {
      // Obter todos os usuários para atualizar seus arquivos locais
      const { data: users, error } = await supabase.from("profiles").select("user_id")

      if (error) throw error

      // Para cada usuário, verificar e atualizar seus desafios armazenados
      for (const userObj of users || []) {
        const userId = userObj.user_id

        // Pular a doutora
        if (userId === DOCTOR_ID) continue

        // Verificar e atualizar desafios diários
        await updateChallengeInFile(userId, getDailyChallengesFilePath(userId), challengeId, updatedChallenge)

        // Verificar e atualizar desafios semanais
        await updateChallengeInFile(userId, getWeeklyChallengesFilePath(userId), challengeId, updatedChallenge)
      }
    } catch (error) {
      console.error("Erro ao atualizar desafio nos arquivos locais:", error)
    }
  }

  // Função auxiliar para atualizar um desafio em um arquivo específico
  const updateChallengeInFile = async (
    userId: string,
    filePath: string,
    challengeId: string,
    updatedChallenge: Challenge,
  ) => {
    try {
      // Verificar se o arquivo existe
      const fileInfo = await FileSystem.getInfoAsync(filePath)

      if (!fileInfo.exists) {
        return // Arquivo não existe, nada a fazer
      }

      // Ler o arquivo
      const jsonString = await FileSystem.readAsStringAsync(filePath)
      const data = JSON.parse(jsonString) as StoredChallenges

      // Verificar se o desafio está no arquivo
      const challengeIndex = data.challenges.findIndex((c) => c.challenge_id === challengeId)

      if (challengeIndex >= 0) {
        // Atualizar o desafio
        data.challenges[challengeIndex] = {
          ...data.challenges[challengeIndex],
          challenge_title: updatedChallenge.challenge_title,
          challenge_text: updatedChallenge.challenge_text,
          challenge_type: updatedChallenge.challenge_type,
          challenge_character: updatedChallenge.challenge_character,
          allows_drawing: updatedChallenge.allows_drawing,
        }

        // Salvar o arquivo atualizado
        await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data))
        console.log(`Desafio atualizado no arquivo ${filePath} para o usuário ${userId}`)
      }
    } catch (error) {
      console.error(`Erro ao atualizar desafio no arquivo ${filePath}:`, error)
    }
  }

  // Modificar a função deleteChallenge para remover o desafio dos arquivos locais
  const deleteChallenge = async (challengeId: string) => {
    try {
      Alert.alert(
        "Confirmar exclusão",
        "Tem certeza que deseja excluir este desafio? Esta ação não pode ser desfeita.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Excluir",
            style: "destructive",
            onPress: async () => {
              setLoading(true)

              try {
                // Excluir o desafio do banco de dados
                const { error } = await supabase.from("challenges").delete().eq("challenge_id", challengeId)

                if (error) throw error

                // Remover o desafio dos arquivos locais e substituí-lo por um novo
                await replaceChallengeInLocalStorage(challengeId)

                Alert.alert("Sucesso", "Desafio excluído com sucesso!")
                fetchChallenges() // Recarregar a lista de desafios
              } catch (error) {
                console.error("Erro ao excluir desafio:", error)
                Alert.alert("Erro", "Não foi possível excluir o desafio. Tente novamente.")
              } finally {
                setLoading(false)
              }
            },
          },
        ],
      )
    } catch (error) {
      console.error("Erro ao preparar exclusão do desafio:", error)
      Alert.alert("Erro", "Não foi possível processar a solicitação. Tente novamente.")
    }
  }

  // Adicionar função para substituir um desafio excluído nos arquivos locais
  const replaceChallengeInLocalStorage = async (challengeId: string) => {
    try {
      // Obter todos os usuários para verificar seus arquivos locais
      const { data: users, error } = await supabase.from("profiles").select("user_id")

      if (error) throw error

      // Buscar todos os desafios disponíveis para substituição
      const { data: dailyChallenges, error: dailyError } = await supabase
        .from("challenges")
        .select("*")
        .eq("challenge_type", "daily")
        .order("created_at", { ascending: false })

      if (dailyError) throw dailyError

      const { data: weeklyChallenges, error: weeklyError } = await supabase
        .from("challenges")
        .select("*")
        .eq("challenge_type", "weekly")
        .order("created_at", { ascending: false })

      if (weeklyError) throw weeklyError

      // Para cada usuário, verificar e atualizar seus desafios armazenados
      for (const userObj of users || []) {
        const userId = userObj.user_id

        // Pular a doutora
        if (userId === DOCTOR_ID) continue

        // Verificar e substituir nos desafios diários
        await replaceChallengeInFile(
          userId,
          getDailyChallengesFilePath(userId),
          challengeId,
          dailyChallenges || [],
          "daily",
        )

        // Verificar e substituir nos desafios semanais
        await replaceChallengeInFile(
          userId,
          getWeeklyChallengesFilePath(userId),
          challengeId,
          weeklyChallenges || [],
          "weekly",
        )
      }
    } catch (error) {
      console.error("Erro ao substituir desafio nos arquivos locais:", error)
    }
  }

  // Função auxiliar para substituir um desafio em um arquivo específico
  const replaceChallengeInFile = async (
    userId: string,
    filePath: string,
    challengeId: string,
    availableChallenges: Challenge[],
    challengeType: "daily" | "weekly",
  ) => {
    try {
      // Verificar se o arquivo existe
      const fileInfo = await FileSystem.getInfoAsync(filePath)

      if (!fileInfo.exists) {
        return // Arquivo não existe, nada a fazer
      }

      // Ler o arquivo
      const jsonString = await FileSystem.readAsStringAsync(filePath)
      const data = JSON.parse(jsonString) as StoredChallenges

      // Verificar se o desafio está no arquivo
      const challengeIndex = data.challenges.findIndex((c) => c.challenge_id === challengeId)

      if (challengeIndex >= 0) {
        // Filtrar desafios do mesmo tipo que não estão já no arquivo
        const existingIds = data.challenges.map((c) => c.challenge_id)
        const eligibleChallenges = availableChallenges.filter(
          (c) =>
            c.challenge_type === challengeType &&
            !existingIds.includes(c.challenge_id) &&
            c.challenge_id !== challengeId,
        )

        if (eligibleChallenges.length > 0) {
          // Selecionar um desafio aleatório para substituição
          const replacementChallenge = getRandomChallenges(eligibleChallenges, 1)[0]

          // Substituir o desafio excluído
          data.challenges[challengeIndex] = replacementChallenge

          // Salvar o arquivo atualizado
          await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data))
          console.log(`Desafio substituído no arquivo ${filePath} para o usuário ${userId}`)
        } else {
          // Se não houver desafios elegíveis, remover o desafio excluído
          data.challenges = data.challenges.filter((c) => c.challenge_id !== challengeId)

          // Salvar o arquivo atualizado
          await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data))
          console.log(`Desafio removido do arquivo ${filePath} para o usuário ${userId} (sem substituição disponível)`)
        }
      }
    } catch (error) {
      console.error(`Erro ao substituir desafio no arquivo ${filePath}:`, error)
    }
  }

  // Adicionar função para abrir o modal de respostas
  const openResponsesModal = () => {
    setResponsesPage(1)
    setChallengeResponses([])
    setPatientSearchQuery("")
    setViewingDrawing(false)
    setCurrentDrawingUrl("")
    setResponsesModalVisible(true)
    fetchChallengeResponses(true)
  }

  // Função para verificar se os desafios diários devem ser atualizados
  const shouldUpdateDailyChallenges = (timestamp: string): boolean => {
    const today = new Date()
    const challengeDate = new Date(timestamp)

    // Verificar se é um novo dia (passou da meia-noite)
    return (
      today.getDate() !== challengeDate.getDate() ||
      today.getMonth() !== challengeDate.getMonth() ||
      today.getFullYear() !== challengeDate.getFullYear()
    )
  }

  // Função para verificar se os desafios semanais devem ser atualizados
  const shouldUpdateWeeklyChallenges = (timestamp: string): boolean => {
    const today = new Date()
    const challengeDate = new Date(timestamp)

    // Calcular a diferença em dias
    const diffTime = Math.abs(today.getTime() - challengeDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Atualizar se passaram 7 dias ou mais
    return diffDays >= 7
  }

  // Função para obter o caminho do arquivo de desafios diários
  const getDailyChallengesFilePath = (userId: string): string => {
    return `${FileSystem.documentDirectory}daily_challenges_${userId}.json`
  }

  // Função para obter o caminho do arquivo de desafios semanais
  const getWeeklyChallengesFilePath = (userId: string): string => {
    return `${FileSystem.documentDirectory}weekly_challenges_${userId}.json`
  }

  // Função para armazenar desafios diários usando FileSystem
  const storeDailyChallenges = async (data: StoredChallenges) => {
    try {
      if (!user) {
        console.log("Usuário não disponível para armazenar desafios diários")
        return false
      }

      const filePath = getDailyChallengesFilePath(user.id)
      const jsonString = JSON.stringify(data)

      await FileSystem.writeAsStringAsync(filePath, jsonString)

      console.log("Desafios diários armazenados com sucesso em:", filePath)
      return true
    } catch (error) {
      console.error("Erro ao armazenar desafios diários:", error)
      return false
    }
  }

  // Função para recuperar desafios diários armazenados usando FileSystem
  const getStoredDailyChallenges = async (): Promise<StoredChallenges | null> => {
    try {
      if (!user) {
        console.log("Usuário não disponível para recuperar desafios diários")
        return null
      }

      const filePath = getDailyChallengesFilePath(user.id)

      // Verificar se o arquivo existe
      const fileInfo = await FileSystem.getInfoAsync(filePath)

      if (!fileInfo.exists) {
        console.log("Arquivo de desafios diários não encontrado:", filePath)
        return null
      }

      const jsonString = await FileSystem.readAsStringAsync(filePath)
      console.log("Desafios diários recuperados com sucesso")

      return JSON.parse(jsonString)
    } catch (error) {
      console.error("Erro ao recuperar desafios diários:", error)
      return null
    }
  }

  // Função para armazenar desafios semanais usando FileSystem
  const storeWeeklyChallenges = async (data: StoredChallenges) => {
    try {
      if (!user) {
        console.log("Usuário não disponível para armazenar desafios semanais")
        return false
      }

      const filePath = getWeeklyChallengesFilePath(user.id)
      const jsonString = JSON.stringify(data)

      await FileSystem.writeAsStringAsync(filePath, jsonString)

      console.log("Desafios semanais armazenados com sucesso em:", filePath)
      return true
    } catch (error) {
      console.error("Erro ao armazenar desafios semanais:", error)
      return false
    }
  }

  // Função para recuperar desafios semanais armazenados usando FileSystem
  const getStoredWeeklyChallenges = async (): Promise<StoredChallenges | null> => {
    try {
      if (!user) {
        console.log("Usuário não disponível para recuperar desafios semanais")
        return null
      }

      const filePath = getWeeklyChallengesFilePath(user.id)

      // Verificar se o arquivo existe
      const fileInfo = await FileSystem.getInfoAsync(filePath)

      if (!fileInfo.exists) {
        console.log("Arquivo de desafios semanais não encontrado:", filePath)
        return null
      }

      const jsonString = await FileSystem.readAsStringAsync(filePath)
      console.log("Desafios semanais recuperados com sucesso")

      return JSON.parse(jsonString)
    } catch (error) {
      console.error("Erro ao recuperar desafios semanais:", error)
      return null
    }
  }

  // Função para selecionar desafios aleatórios
  const getRandomChallenges = (challenges: Challenge[], count: number): Challenge[] => {
    if (challenges.length <= count) {
      return challenges
    }

    const shuffled = [...challenges].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, count)
  }

  // Navegar para a tela de detalhes do desafio
  const navigateToChallengeDetail = (challenge: Challenge) => {
    router.push({
      pathname: "/challenge-detail",
      params: {
        challengeId: challenge.challenge_id,
        challengeTitle: challenge.challenge_title,
        challengeText: challenge.challenge_text,
        challengeCharacter: challenge.challenge_character,
        allowsDrawing: challenge.allows_drawing ? "true" : "false",
        challengeType: challenge.challenge_type,
      },
    })
  }

  // Atualizar desafios quando a tela receber foco
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (user) {
        fetchChallenges()
      }
    })

    return unsubscribe
  }, [navigation, user])

  // Modificar a função renderResponseItem para implementar a visualização do desenho
  const renderResponseItem = ({ item }: { item: ChallengeResponse }) => {
    return (
      <View style={styles.responseCard}>
        <View style={styles.responseHeader}>
          <Text style={styles.responsePatientName}>{item.user_name}</Text>
          <Text style={styles.responseDate}>{new Date(item.completed_at).toLocaleDateString("pt-BR")}</Text>
        </View>
        <Text style={styles.responseChallengeTitle}>{item.challenge_title}</Text>
        {item.answer && (
          <View style={styles.responseContent}>
            <Text style={styles.responseLabel}>Resposta:</Text>
            <Text style={styles.responseText}>{item.answer}</Text>
          </View>
        )}
        {item.drawing_url && (
          <View style={styles.responseContent}>
            <Text style={styles.responseLabel}>Desenho:</Text>
            <TouchableOpacity
              style={styles.viewDrawingButton}
              onPress={() => {
                // Definir o modo de visualização de desenho
                setCurrentDrawingUrl(item.drawing_url || "")
                setViewingDrawing(true)
              }}
            >
              <Text style={styles.viewDrawingButtonText}>Ver desenho</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }

  // Adicionar função para renderizar um desafio para a doutora
  const renderDoctorChallengeItem = (challenge: Challenge, index: number) => {
    return (
      <Animated.View
        key={challenge.id}
        style={[
          styles.challengeCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.challengeHeader}>
          <View style={styles.challengeTitleContainer}>
            <Text style={styles.challengeTitle}>{challenge.challenge_title}</Text>
            <Text style={styles.challengeType}>
              {challenge.challenge_type === "daily" ? "Desafio Diário" : "Desafio Semanal"}
            </Text>
          </View>
          <View style={styles.characterContainer}>
            <Text style={styles.characterEmoji}>{challenge.challenge_character}</Text>
          </View>
        </View>

        <Text style={styles.challengeText} numberOfLines={3} ellipsizeMode="tail">
          {challenge.challenge_text}
        </Text>

        <View style={styles.challengeInfo}>
          <Text style={styles.challengeInfoText}>Permite desenho: {challenge.allows_drawing ? "Sim" : "Não"}</Text>
          <Text style={styles.challengeInfoText}>
            Criado em: {new Date(challenge.created_at).toLocaleDateString("pt-BR")}
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionButton, styles.editButton]} onPress={() => openEditModal(challenge)}>
            <Text style={styles.actionButtonText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => deleteChallenge(challenge.challenge_id)}
          >
            <Text style={styles.actionButtonText}>Excluir</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    )
  }

  // Função para renderizar um desafio
  const renderChallenge = (challenge: Challenge, index: number, type: "daily" | "weekly") => {
    const isCompleted = completedChallengeIds.includes(challenge.challenge_id)

    return (
      <Animated.View
        key={challenge.id}
        style={[
          styles.challengeCard,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.challengeHeader}>
          <View style={styles.challengeTitleContainer}>
            <Text style={styles.challengeTitle}>{challenge.challenge_title}</Text>
            <Text style={styles.challengeType}>{type === "daily" ? "Desafio Diário" : "Desafio Semanal"}</Text>
          </View>
          <View style={styles.characterContainer}>
            <Text style={styles.characterEmoji}>{challenge.challenge_character}</Text>
          </View>
        </View>

        <Text style={styles.challengeText} numberOfLines={3} ellipsizeMode="tail">
          {challenge.challenge_text}
        </Text>

        <TouchableOpacity
          style={[styles.accessButton, isCompleted && styles.completedButton]}
          onPress={() => navigateToChallengeDetail(challenge)}
          disabled={isCompleted}
        >
          <Text style={styles.accessButtonText}>{isCompleted ? "Desafio Concluído" : "Acessar Desafio"}</Text>
        </TouchableOpacity>
      </Animated.View>
    )
  }

  if (isDoctor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Gerenciar Desafios</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.doctorActions}>
            <TouchableOpacity style={styles.responsesButton} onPress={openResponsesModal}>
              <Text style={styles.responsesButtonText}>Desafios Respondidos</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
              <Text style={styles.createButtonText}>Criar Novo Desafio</Text>
            </TouchableOpacity>
          </View>

          {/* Seção de Desafios Diários com filtro de pesquisa */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Desafios Diários</Text>
            <Text style={styles.sectionDescription}>Desafios que os pacientes podem completar diariamente.</Text>

            {/* Campo de pesquisa para desafios diários */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={dailySearchQuery}
                onChangeText={setDailySearchQuery}
                placeholder="Buscar desafio diário..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="search"
              />
            </View>

            {filteredDailyChallenges.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {dailySearchQuery.trim() ? "Nenhum desafio diário encontrado" : "Nenhum desafio diário cadastrado"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {dailySearchQuery.trim()
                    ? "Tente outro termo de busca."
                    : 'Clique em "Criar Novo Desafio" para adicionar.'}
                </Text>
              </View>
            ) : (
              filteredDailyChallenges.map((challenge, index) => renderDoctorChallengeItem(challenge, index))
            )}
          </View>

          {/* Seção de Desafios Semanais com filtro de pesquisa */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Desafios Semanais</Text>
            <Text style={styles.sectionDescription}>
              Desafios mais complexos que os pacientes podem completar ao longo da semana.
            </Text>

            {/* Campo de pesquisa para desafios semanais */}
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={weeklySearchQuery}
                onChangeText={setWeeklySearchQuery}
                placeholder="Buscar desafio semanal..."
                placeholderTextColor="#9CA3AF"
                returnKeyType="search"
              />
            </View>

            {filteredWeeklyChallenges.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {weeklySearchQuery.trim() ? "Nenhum desafio semanal encontrado" : "Nenhum desafio semanal cadastrado"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {weeklySearchQuery.trim()
                    ? "Tente outro termo de busca."
                    : 'Clique em "Criar Novo Desafio" para adicionar.'}
                </Text>
              </View>
            ) : (
              filteredWeeklyChallenges.map((challenge, index) => renderDoctorChallengeItem(challenge, index))
            )}
          </View>
        </ScrollView>

        {/* Modal para criar/editar desafio */}
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{editingChallenge ? "Editar Desafio" : "Criar Novo Desafio"}</Text>

                <Text style={styles.inputLabel}>Título do Desafio</Text>
                <TextInput
                  style={styles.input}
                  value={challengeTitle}
                  onChangeText={setChallengeTitle}
                  placeholder="Digite o título do desafio"
                  placeholderTextColor="#9CA3AF"
                />

                <Text style={styles.inputLabel}>Texto do Desafio</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={challengeText}
                  onChangeText={setChallengeText}
                  placeholder="Digite o texto do desafio"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />

                <Text style={styles.inputLabel}>Tipo de Desafio</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={[styles.radioOption, challengeType === "daily" && styles.radioOptionSelected]}
                    onPress={() => setChallengeType("daily")}
                  >
                    <Text style={[styles.radioText, challengeType === "daily" && styles.radioTextSelected]}>
                      Diário
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.radioOption, challengeType === "weekly" && styles.radioOptionSelected]}
                    onPress={() => setChallengeType("weekly")}
                  >
                    <Text style={[styles.radioText, challengeType === "weekly" && styles.radioTextSelected]}>
                      Semanal
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Personagem</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={[styles.radioOption, challengeCharacter === "Amy" && styles.radioOptionSelected]}
                    onPress={() => setChallengeCharacter("Amy")}
                  >
                    <Text style={[styles.radioText, challengeCharacter === "Amy" && styles.radioTextSelected]}>
                      Amy
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.radioOption, challengeCharacter === "Angelita" && styles.radioOptionSelected]}
                    onPress={() => setChallengeCharacter("Angelita")}
                  >
                    <Text style={[styles.radioText, challengeCharacter === "Angelita" && styles.radioTextSelected]}>
                      Angelita
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.radioOption, challengeCharacter === "Grãozinho" && styles.radioOptionSelected]}
                    onPress={() => setChallengeCharacter("Grãozinho")}
                  >
                    <Text style={[styles.radioText, challengeCharacter === "Grãozinho" && styles.radioTextSelected]}>
                      Grãozinho
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.inputLabel}>Permite Desenho</Text>
                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>{allowsDrawing ? "Sim" : "Não"}</Text>
                  <Switch
                    value={allowsDrawing}
                    onValueChange={setAllowsDrawing}
                    trackColor={{ false: "#E5E7EB", true: "#F163E0" }}
                    thumbColor={allowsDrawing ? "#FFFFFF" : "#FFFFFF"}
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalCancelButton} onPress={() => setModalVisible(false)}>
                    <Text style={styles.modalCancelButtonText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.modalSaveButton} onPress={saveChallenge} disabled={loading}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalSaveButtonText}>Salvar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Modal para visualizar respostas de desafios */}
        <Modal
          visible={responsesModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setResponsesModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.responsesModalContent}>
              {viewingDrawing ? (
                // Modo de visualização de desenho
                <View style={styles.drawingViewMode}>
                  <View style={styles.responsesModalHeader}>
                    <TouchableOpacity style={styles.backButton} onPress={() => setViewingDrawing(false)}>
                      <Text style={styles.backButtonText}>← Voltar</Text>
                    </TouchableOpacity>
                    <Text style={styles.responsesModalTitle}>Visualização do Desenho</Text>
                    <TouchableOpacity style={styles.closeButton} onPress={() => setResponsesModalVisible(false)}>
                      <Text style={styles.closeButtonText}>Fechar</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.drawingContainer}>
                    {currentDrawingUrl ? (
                      <Image source={{ uri: currentDrawingUrl }} style={styles.drawingImage} resizeMode="contain" />
                    ) : (
                      <View style={styles.drawingPlaceholder}>
                        <Text style={styles.drawingPlaceholderText}>Não foi possível carregar o desenho</Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                // Modo de lista de respostas (original)
                <>
                  <View style={styles.responsesModalHeader}>
                    <Text style={styles.responsesModalTitle}>Desafios Respondidos</Text>
                    <TouchableOpacity style={styles.closeButton} onPress={() => setResponsesModalVisible(false)}>
                      <Text style={styles.closeButtonText}>Fechar</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.searchContainer}>
                    <TextInput
                      style={styles.searchInput}
                      value={patientSearchQuery}
                      onChangeText={(text) => {
                        setPatientSearchQuery(text)
                        applyResponseFilters(allChallengeResponses, text, responsesPeriod)
                      }}
                      placeholder="Buscar por nome do paciente..."
                      placeholderTextColor="#9CA3AF"
                      returnKeyType="search"
                    />
                    <TouchableOpacity style={styles.searchButton} onPress={() => fetchChallengeResponses(true)}>
                      <Text style={styles.searchButtonText}>Atualizar</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.periodFilter}>
                    <Text style={styles.periodFilterLabel}>Filtrar por período:</Text>
                    <View style={styles.periodOptions}>
                      <TouchableOpacity
                        style={[styles.periodOption, responsesPeriod === "today" && styles.periodOptionSelected]}
                        onPress={() => {
                          setResponsesPeriod("today")
                          applyResponseFilters(allChallengeResponses, patientSearchQuery, "today")
                        }}
                      >
                        <Text
                          style={[
                            styles.periodOptionText,
                            responsesPeriod === "today" && styles.periodOptionTextSelected,
                          ]}
                        >
                          Hoje
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.periodOption, responsesPeriod === "week" && styles.periodOptionSelected]}
                        onPress={() => {
                          setResponsesPeriod("week")
                          applyResponseFilters(allChallengeResponses, patientSearchQuery, "week")
                        }}
                      >
                        <Text
                          style={[
                            styles.periodOptionText,
                            responsesPeriod === "week" && styles.periodOptionTextSelected,
                          ]}
                        >
                          7 dias
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.periodOption, responsesPeriod === "month" && styles.periodOptionSelected]}
                        onPress={() => {
                          setResponsesPeriod("month")
                          applyResponseFilters(allChallengeResponses, patientSearchQuery, "month")
                        }}
                      >
                        <Text
                          style={[
                            styles.periodOptionText,
                            responsesPeriod === "month" && styles.periodOptionTextSelected,
                          ]}
                        >
                          30 dias
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.periodOption, responsesPeriod === "all" && styles.periodOptionSelected]}
                        onPress={() => {
                          setResponsesPeriod("all")
                          applyResponseFilters(allChallengeResponses, patientSearchQuery, "all")
                        }}
                      >
                        <Text
                          style={[
                            styles.periodOptionText,
                            responsesPeriod === "all" && styles.periodOptionTextSelected,
                          ]}
                        >
                          Todos
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {loadingResponses && challengeResponses.length === 0 ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#F163E0" />
                      <Text style={styles.loadingText}>Carregando respostas...</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={challengeResponses}
                      renderItem={renderResponseItem}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={styles.responsesListContainer}
                      ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                          <Text style={styles.emptyText}>Nenhuma resposta encontrada</Text>
                          <Text style={styles.emptySubtext}>Tente ajustar os filtros ou período.</Text>
                        </View>
                      }
                      onEndReached={() => {
                        if (hasMoreResponses && !loadingResponses) {
                          fetchChallengeResponses()
                        }
                      }}
                      onEndReachedThreshold={0.1}
                      ListFooterComponent={
                        loadingResponses && challengeResponses.length > 0 ? (
                          <ActivityIndicator size="small" color="#F163E0" style={styles.loadingMore} />
                        ) : null
                      }
                    />
                  )}
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    )
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>Carregando desafios...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Desafios</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Seção de Desafios Diários */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Desafios Diários</Text>
          <Text style={styles.sectionDescription}>
            Complete estes desafios hoje para melhorar suas habilidades emocionais.
          </Text>

          {dailyChallenges.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Você completou todos os desafios diários disponíveis!</Text>
              <Text style={styles.emptySubtext}>Volte amanhã para novos desafios.</Text>
            </View>
          ) : (
            dailyChallenges.map((challenge, index) => renderChallenge(challenge, index, "daily"))
          )}
        </View>

        {/* Seção de Desafios Semanais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Desafios Semanais</Text>
          <Text style={styles.sectionDescription}>
            Desafios mais complexos que você pode completar ao longo da semana.
          </Text>

          {weeklyChallenges.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Você completou todos os desafios semanais disponíveis!</Text>
              <Text style={styles.emptySubtext}>Novos desafios serão disponibilizados na próxima segunda-feira.</Text>
            </View>
          ) : (
            weeklyChallenges.map((challenge, index) => renderChallenge(challenge, index, "weekly"))
          )}
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={fetchChallenges}>
          <Text style={styles.refreshButtonText}>Atualizar Desafios</Text>
        </TouchableOpacity>
      </ScrollView>
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
  challengeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  challengeTitleContainer: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  challengeType: {
    fontSize: 12,
    color: "#6B7280",
  },
  characterContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  characterEmoji: {
    fontSize: 24,
  },
  challengeText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
    marginBottom: 20,
  },
  accessButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  completedButton: {
    backgroundColor: "#4ADE80",
  },
  accessButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
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

  // Estilos para a interface da doutora
  doctorActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  responsesButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  responsesButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  createButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  challengeInfo: {
    marginTop: 8,
    marginBottom: 12,
  },
  challengeInfoText: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: "#6366F1",
  },
  deleteButton: {
    backgroundColor: "#EF4444",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
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
    maxWidth: 500,
    maxHeight: "90%",
  },
  responsesModalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    width: "100%",
    maxWidth: 500,
    maxHeight: "90%",
    flex: 1,
    margin: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
    textAlign: "center",
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
    marginBottom: 16,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  radioGroup: {
    flexDirection: "row",
    marginBottom: 16,
  },
  radioOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    marginRight: 8,
    alignItems: "center",
  },
  radioOptionSelected: {
    backgroundColor: "#F163E0",
    borderColor: "#F163E0",
  },
  radioText: {
    fontSize: 14,
    color: "#4B5563",
  },
  radioTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  switchLabel: {
    fontSize: 16,
    color: "#4B5563",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginRight: 8,
    alignItems: "center",
  },
  modalCancelButtonText: {
    color: "#4B5563",
    fontWeight: "600",
    fontSize: 16,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F163E0",
    borderRadius: 8,
    marginLeft: 8,
    alignItems: "center",
  },
  modalSaveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  responsesModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  responsesModalTitle: {
    fontSize: 18,
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
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 0,
    backgroundColor: "#FFFFFF",
  },
  searchInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  periodFilter: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  periodFilterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 8,
  },
  periodOptions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  periodOption: {
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
  periodOptionSelected: {
    backgroundColor: "#F163E0",
    borderColor: "#F163E0",
  },
  periodOptionText: {
    fontSize: 14,
    color: "#4B5563",
  },
  periodOptionTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  responsesListContainer: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: "#F3F4F6",
  },
  responseCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  drawingViewMode: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    width: "100%",
  },
  drawingContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  drawingImage: {
    width: "100%",
    height: "100%",
  },
  drawingPlaceholder: {
    padding: 20,
    alignItems: "center",
  },
  drawingPlaceholderText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  responseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  responsePatientName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  responseDate: {
    fontSize: 14,
    color: "#6B7280",
  },
  responseChallengeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 12,
  },
  responseContent: {
    marginTop: 8,
  },
  responseLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 20,
  },
  viewDrawingButton: {
    backgroundColor: "#6366F1",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  viewDrawingButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  loadingMore: {
    marginVertical: 16,
  },
})

export default ChallengesScreen
