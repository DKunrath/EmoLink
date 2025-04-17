"use client"

import type React from "react"

import { useEffect, useState, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  SafeAreaView,
  Dimensions,
  TextInput,
  Modal,
  Alert,
  Platform,
} from "react-native"
import { useRoute, useNavigation } from "@react-navigation/native"
import { supabase } from "../../../services/supabase"
import type { RouteProp } from "@react-navigation/native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { useAuth } from "../../../hooks/useAuth"
import { updateUserPoints } from '../../../services/diary';
import { useAlertContext } from "../../../components/alert-provider"

// ID da doutora
const DOCTOR_ID = "b46ab255-8937-4904-9ba1-3d533027b0d9"

// Remova o componente Tooltip existente e substitua por este novo componente
// Substitua:
// Por este novo componente:
const Tooltip = ({ visible, children, message }: { visible: boolean; children: React.ReactNode; message: string }) => {
  return children
}

export default function StoryPageScreen() {
  interface RouteParams {
    storyId: string
    useChildContent?: boolean
  }
  type StoryPageRouteProp = RouteProp<{ params: RouteParams }, "params">
  const route = useRoute<StoryPageRouteProp>()
  const scrollViewRef = useRef<ScrollView>(null) // Referência para o ScrollView
  const navigation = useNavigation()
  const { storyId } = route.params
  const { user } = useAuth()
  const [isReady, setIsReady] = useState(false)
  const [imageLoading, setImageLoading] = useState(true) // Estado para controlar o carregamento da imagem
  const { success, error2, warning, info } = useAlertContext()

  // Verificar se o usuário é a doutora
  const isDoctor = user?.id === DOCTOR_ID

  type Page = {
    id: string
    title: string
    content: string
    content2?: string
    child_content: string
    child_content2?: string
    image_url?: string
    image_url_2?: string
    allows_drawing: boolean
    hint?: string // Adicionando o campo hint
  }

  const [pages, setPages] = useState<Page[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  // Estados para edição
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editImage, setEditImage] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editContent2, setEditContent2] = useState("")
  const [childContent, setChildContent] = useState("")
  const [childContent2, setChildContent2] = useState("")
  const [editHint, setEditHint] = useState("")
  const [saving, setSaving] = useState(false)

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  // Animation for page transitions
  const pageTransition = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const start = async () => {
      await fetchPages() // se fetchPages também for async
      setIsReady(true)
    }
    start()
  }, [])

  useEffect(() => {
    // Animate page transition
    pageTransition.setValue(1) // Start with the page slightly to the right

    Animated.timing(pageTransition, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start()

    // Esconder o tooltip ao mudar de página
    setTooltipVisible(false)
  }, [currentPage])

  const fetchPages = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("story_pages")
        .select("*")
        .eq("story_id", storyId)
        .order("page_number", { ascending: true })

      if (error) {
        console.error("Erro ao buscar páginas:", error)
      } else {
        setPages(data || [])

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
    } catch (error) {
      console.error("Erro em fetchPages:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!isReady) {
    return <Text>Carregando...</Text>
  }

  const handleNextPage = () => {
    if (currentPage < pages.length - 1) {
      setImageLoading(true)
      setCurrentPage(currentPage + 1)

      // Rola para o topo da próxima página
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    }
  }

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setImageLoading(true)
      setCurrentPage(currentPage - 1)

      // Rola para o topo da próxima página
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    }
  }

  const handleConclude = async () => {
    if (user) {
      await updateUserPoints(user.id, 5);
    } else {
      error2("Erro", "Usuário não autenticado. Não é possível ganhar pontos!");
    }
    // Show a success alert and navigate back
    success("Sucesso!", "Você concluiu a história, e ganhou 5 pontos!")
    navigation.goBack()
  }

  const toggleTooltip = () => {
    setTooltipVisible(!tooltipVisible)
  }

  // Função para abrir o modal de edição
  const handleEditPage = () => {
    const currentPageData = pages[currentPage]
    setEditContent(currentPageData.content)
    setEditContent2(currentPageData.content2 || "")
    setEditImage(currentPageData.image_url || "")
    setEditHint(currentPageData.hint || "")
    setEditModalVisible(true)
  }

  // Função para salvar as alterações
  const handleSavePage = async () => {
    setSaving(true)

    try {
      const currentPageData = pages[currentPage]

      const { error } = await supabase
        .from("story_pages")
        .update({
          content: editContent,
          content2: editContent2 || null,
          image_url: editImage || null,
          hint: editHint || null,
        })
        .eq("id", currentPageData.id)

      if (error) {
        throw error
      }

      // Atualizar a página localmente
      const updatedPages = [...pages]
      updatedPages[currentPage] = {
        ...currentPageData,
        image_url: editImage || undefined,
        content: editContent,
        content2: editContent2 || undefined,
        hint: editHint || undefined,
      }

      setPages(updatedPages)
      setEditModalVisible(false)
      Alert.alert("Sucesso", "Página atualizada com sucesso!")
    } catch (error) {
      console.error("Erro ao atualizar página:", error)
      Alert.alert("Erro", "Não foi possível atualizar a página. Tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>Carregando história...</Text>
      </View>
    )
  }

  if (pages.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Nenhuma página encontrada</Text>
        <Text style={styles.emptySubtitle}>Esta história ainda não possui conteúdo</Text>
      </View>
    )
  }

  const page = pages[currentPage]
  const progress = ((currentPage + 1) / pages.length) * 100
  const isLastPage = currentPage === pages.length - 1

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBar, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.pageIndicator}>
              Página {currentPage + 1} de {pages.length}
            </Text>
          </View>

          {/* Botão de edição (apenas para a doutora) */}
          {isDoctor && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditPage}>
              <Text style={styles.editButtonText}>Editar Página</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.pageContent,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  {
                    translateX: pageTransition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 30],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Botão de dica */}
            {page.hint && (
              <TouchableOpacity style={styles.hintButton} onPress={toggleTooltip}>
                <View style={styles.hintIcon}>
                  <Text style={styles.hintIconText}>?</Text>
                </View>
              </TouchableOpacity>
            )}

            <Text style={styles.pageTitle}>{page.title}</Text>

            {!route.params.useChildContent && (
              <Text style={styles.pageText}>{page.content}</Text>
            )}

            {route.params.useChildContent && (
              <Text style={styles.pageText}>{page.child_content}</Text>
            )}

            {page.image_url && currentPage < 4 && storyId === "6598a360-23cf-4ee8-98d2-3d1f85b4fa93" && isReady && (
              <View style={styles.imageContainer}>
                {imageLoading && <ActivityIndicator size="large" color="#F163E0" style={styles.imageLoader} />}
                {Platform.OS === "web" ? (
                  <img
                    src={page.image_url || "/placeholder.svg"}
                    onLoad={() => setImageLoading(false)}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 12,
                      backgroundColor: "#E5E7EB",
                    }}
                  />
                ) : (
                  <Image
                    source={{ uri: page.image_url }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoad={() => setImageLoading(false)}
                  />
                )}
              </View>
            )}

            {page.image_url && storyId === "bcd14c73-67a5-45a9-bc01-79d4e107a4a4" && isReady && (
              <View style={styles.imageContainer}>
                {imageLoading && <ActivityIndicator size="large" color="#F163E0" style={styles.imageLoader} />}
                {Platform.OS === "web" ? (
                  <img
                    src={page.image_url || "/placeholder.svg"}
                    onLoad={() => setImageLoading(false)}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 12,
                      backgroundColor: "#E5E7EB",
                    }}
                  />
                ) : (
                  <Image
                    source={{ uri: page.image_url }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoad={() => setImageLoading(false)}
                  />
                )}
              </View>
            )}

            {page.image_url && currentPage > 3 && storyId === "6598a360-23cf-4ee8-98d2-3d1f85b4fa93" && isReady && (
              <View style={styles.imageContainer}>
                {imageLoading && <ActivityIndicator size="large" color="#F163E0" style={styles.imageLoader} />}
                {Platform.OS === "web" ? (
                  <img
                    src={page.image_url || "/placeholder.svg"}
                    onLoad={() => setImageLoading(false)}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 12,
                      backgroundColor: "#E5E7EB",
                    }}
                  />
                ) : (
                  <Image
                    source={{ uri: page.image_url }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoad={() => setImageLoading(false)}
                  />
                )}
              </View>
            )}

            {!route.params.useChildContent && (
              <Text style={styles.pageText}>{page.content2}</Text>
            )}

            {route.params.useChildContent && (
              <Text style={styles.pageText}>{page.child_content2}</Text>
            )}

            {page.content2 !== null && storyId === "6598a360-23cf-4ee8-98d2-3d1f85b4fa93" && isReady && (
              <View style={styles.imageContainer}>
                {imageLoading && <ActivityIndicator size="large" color="#F163E0" style={styles.imageLoader} />}
                {Platform.OS === "web" ? (
                  <img
                    src={page.image_url_2 || "/placeholder.svg"}
                    onLoad={() => setImageLoading(false)}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 12,
                      backgroundColor: "#E5E7EB",
                    }}
                  />
                ) : (
                  <Image
                    source={{ uri: page.image_url_2 }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoad={() => setImageLoading(false)}
                  />
                )}
              </View>
            )}

            {page.content2 !== null && storyId === "bcd14c73-67a5-45a9-bc01-79d4e107a4a4" && isReady && (
              <View style={styles.imageContainer}>
                {imageLoading && <ActivityIndicator size="large" color="#F163E0" style={styles.imageLoader} />}
                {Platform.OS === "web" ? (
                  <img
                    src={page.image_url || "/placeholder.svg"}
                    onLoad={() => setImageLoading(false)}
                    alt=""
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      borderRadius: 12,
                      backgroundColor: "#E5E7EB",
                    }}
                  />
                ) : (
                  <Image
                    source={{ uri: page.image_url }}
                    style={styles.image}
                    resizeMode="contain"
                    onLoad={() => setImageLoading(false)}
                  />
                )}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[styles.navButton, currentPage === 0 && styles.navButtonDisabled]}
            onPress={handlePreviousPage}
            disabled={currentPage === 0}
          >
            <Text style={[styles.navButtonText, currentPage === 0 && styles.navButtonTextDisabled]}>Anterior</Text>
          </TouchableOpacity>

          {isLastPage ? (
            // Botão de Concluir na última página
            <TouchableOpacity style={[styles.navButton, styles.concludeButton]} onPress={handleConclude}>
              <Text style={[styles.navButtonText, styles.concludeButtonText]}>Concluir</Text>
            </TouchableOpacity>
          ) : (
            // Botão de Próximo nas outras páginas
            <TouchableOpacity style={[styles.navButton, styles.navButtonPrimary]} onPress={handleNextPage}>
              <Text style={[styles.navButtonText, styles.navButtonTextPrimary]}>Próximo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Modal de Edição */}
        <Modal
          visible={editModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setEditModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Editar Página</Text>

              <Text style={styles.inputLabel}>Conteúdo</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editContent}
                onChangeText={setEditContent}
                placeholder="Conteúdo da página"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Imagem (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editImage}
                onChangeText={setEditImage}
                placeholder="Imagem da página..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />

              <Text style={styles.inputLabel}>Dica (opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editHint}
                onChangeText={setEditHint}
                placeholder="Dica para esta página"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={handleSavePage}
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
          </View>
        </Modal>
        {/* Modal de Tooltip */}
        <Modal visible={tooltipVisible} transparent={true} animationType="fade" onRequestClose={toggleTooltip}>
          <TouchableOpacity style={styles.tooltipModalOverlay} activeOpacity={1} onPress={toggleTooltip}>
            <View style={styles.tooltipContainer}>
              <View style={styles.tooltipContent}>
                <Text style={styles.tooltipText}>{page?.hint || "Sem dica disponível"}</Text>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const { width } = Dimensions.get("window")

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
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
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F3F4F6",
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
    textAlign: "center",
  },
  headerContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    position: "relative",
    paddingBottom: 8,
  },
  progressContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#F163E0",
    borderRadius: 3,
  },
  pageIndicator: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "right",
  },
  // Botão de edição
  editButton: {
    alignSelf: "center",
    backgroundColor: "#F163E0",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  editButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  // Estilos para o botão de dica e tooltip
  hintButton: {
    marginTop: 8, // Add margin to position below the progress bar
    alignSelf: "center", // Align with the page indicator text
  },
  hintIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F163E0",
    justifyContent: "center",
    alignItems: "center",
  },
  hintIconText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Extra padding for navigation buttons
  },
  pageContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  pageText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#374151",
    marginBottom: 20,
  },
  imageContainer: {
    marginVertical: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F9FAFB",
    height: 300, // Altura fixa para acomodar imagens quadradas
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E5E7EB",
    display: "flex",
  },
  imageLoader: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 1,
  },
  drawingContainer: {
    marginTop: 20,
    marginBottom: 16,
  },
  drawingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 12,
  },
  exportContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  navigationContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    minWidth: 100,
    alignItems: "center",
  },
  navButtonPrimary: {
    backgroundColor: "#F163E0",
  },
  concludeButton: {
    backgroundColor: "#4ADE80", // Verde para o botão de concluir
  },
  navButtonDisabled: {
    backgroundColor: "#F3F4F6",
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4B5563",
  },
  navButtonTextPrimary: {
    color: "#FFFFFF",
  },
  concludeButtonText: {
    color: "#FFFFFF",
  },
  navButtonTextDisabled: {
    color: "#9CA3AF",
  },
  // Estilos do Modal
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    marginRight: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#4B5563",
    fontWeight: "600",
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F163E0",
    borderRadius: 8,
    marginLeft: 8,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#F8BBF0",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  tooltipModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  tooltipContainer: {
    width: "80%",
    maxWidth: 300,
  },
  tooltipContent: {
    backgroundColor: "#333",
    borderRadius: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tooltipText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
})
