"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
  TextInput,
  FlatList,
  Image,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useAuth } from "../../../hooks/useAuth"
import { diaryService, type EmotionEntry } from "../../../services/diary"
import { supabase } from "../../../services/supabase"

export const options = {
  headerBackTitle: "Diário",
  title: "Diário", // opcional, para garantir o título correto
};

// ID da doutora
const DOCTOR_ID = "b46ab255-8937-4904-9ba1-3d533027b0d9"

// Interface para os pacientes
interface Patient {
  id: string
  full_name: string
  has_entry_today: boolean
  avatar_url?: string | null
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

export default function DiaryScreen() {
  const [entries, setEntries] = useState<EmotionEntry[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null)
  const { user } = useAuth()
  const { refresh, patientId } = useLocalSearchParams()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  const isDoctor = user?.id === DOCTOR_ID

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
  }, [user, refresh, patientId])

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
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, avatar_url").neq("full_name", "Ana Claudia Cavalcanti").order("full_name")

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
            avatar_url: profile.avatar_url,
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

  // Função para carregar entradas do diário
  const loadEntries = async (refresh = false, userId = selectedPatientId) => {
    if (!userId) return

    try {
      setLoading(true)
      const currentPage = refresh ? 1 : page
      const { entries: newEntries, hasMore: more } = await diaryService.getUserEntries(userId, currentPage)

      setEntries(
        refresh ? newEntries : [...entries, ...newEntries.filter((entry) => !entries.some((e) => e.id === entry.id))],
      )
      setHasMore(more)
      setPage(currentPage + 1)
    } catch (error) {
      return false
    } finally {
      setLoading(false)
      setRefreshing(false)
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

  // Tela de carregamento
  if (loading && entries.length === 0 && patients.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>
          {isDoctor ? "Carregando lista de pacientes..." : "Carregando seu diário..."}
        </Text>
      </View>
    )
  }

  // Tela de lista de pacientes (apenas para a doutora)
  if (isDoctor && !selectedPatientId) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Diários dos Pacientes</Text>
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#F163E0"]} tintColor="#F163E0" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nenhum paciente encontrado</Text>
              <Text style={styles.emptySubtitle}>Tente ajustar sua busca.</Text>
            </View>
          }
        />
      </View>
    )
  }

  // Tela de diário (para pacientes ou doutora visualizando um paciente específico)
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.container}>
        <View style={styles.header}>
          {/* Botão de voltar (apenas para a doutora) */}
          {isDoctor && (
            <TouchableOpacity style={styles.backButton} onPress={backToPatientList}>
              <Text style={styles.backButtonText}>← Voltar</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.title}>Diário de Emoções</Text>

          {/* Botão de adicionar (apenas para pacientes) */}
          {!isDoctor && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push("/(tabs)/diary/select")}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>+ Novo Registro</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#F163E0"]} tintColor="#F163E0" />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent
            const isEndReached = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20
            if (isEndReached && hasMore) {
              loadMore()
            }
          }}
          scrollEventThrottle={400}
        >
          {entries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nenhum registro encontrado no diário!</Text>
              {isDoctor ? (
                <Text style={styles.emptySubtitle}>Este paciente ainda não registrou emoções.</Text>
              ) : (
                <>
                  <Text style={styles.emptySubtitle}>Comece a registrar seus sentimentos.</Text>
                  <TouchableOpacity
                    style={styles.emptyAddButton}
                    onPress={() => router.push("/(tabs)/diary/select")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyAddButtonText}>Adicionar primeiro registro</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <>
              {entries.map((entry, index) => (
                <Animated.View
                  key={entry.id}
                  style={[
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }],
                    },
                  ]}
                >
                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.emotionContainer}>
                        <Text style={styles.emotionIcon}>{getEmotionIcon(entry.emotion_type)}</Text>
                        <Text style={styles.emotionType}>{getEmotionTranslated(entry.emotion_type)}</Text>
                      </View>
                      <Text style={styles.date}>{formatDate(entry.created_at)}</Text>
                    </View>

                    <Text style={styles.description}>{entry.emotion_description}</Text>

                    <View style={styles.intensityContainer}>
                      <Text style={styles.intensityLabel}>Intensidade</Text>
                      <View style={styles.intensityBarContainer}>
                        <View
                          style={[
                            styles.intensityBar,
                            {
                              width: `${entry.intensity}%`,
                              backgroundColor: getEmotionColor(entry.emotion_type),
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.intensityValue}>{entry.intensity}%</Text>
                    </View>
                  </View>
                </Animated.View>
              ))}

              {loading && hasMore && (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#F163E0" />
                  <Text style={styles.loadingMoreText}>Carregando mais registros...</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
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
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: "#F163E0",
    fontWeight: "600",
    fontSize: 14,
  },
  addButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
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
  scrollViewContent: {
    padding: 16,
    paddingBottom: 32,
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
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 40,
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
    marginBottom: 24,
    textAlign: "center",
  },
  emptyAddButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyAddButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  loadingMoreContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  loadingMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#6B7280",
  },
})

