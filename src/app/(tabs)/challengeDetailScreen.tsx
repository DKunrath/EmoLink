"use client"

import { useState, useRef, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import { useLocalSearchParams, router } from "expo-router"
import { supabase } from "../../services/supabase"
import { useAuth } from "../../hooks/useAuth"
import { Svg, Path } from "react-native-svg"
import { PanGestureHandler, State, GestureHandlerRootView } from "react-native-gesture-handler"
import ViewShot from "react-native-view-shot"
import * as FileSystem from "expo-file-system"
import { useAlertContext } from "../../components/alert-provider"
import { updateUserPoints } from '../../services/diary';

interface PathData {
  path: string
  color: string
  strokeWidth: number
}

const ChallengeDetailScreen = () => {
  const params = useLocalSearchParams()
  const navigation = useNavigation()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [responseText, setResponseText] = useState("")
  const [paths, setPaths] = useState<PathData[]>([])
  const [currentPath, setCurrentPath] = useState<string>("")
  const [currentColor, setCurrentColor] = useState<string>("#000000")
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState<number>(3)
  const [uploadProgress, setUploadProgress] = useState(0)
  const viewShotRef = useRef<ViewShot>(null)

  const challengeId = params.challengeId as string
  const challengeTitle = params.challengeTitle as string
  const challengeText = params.challengeText as string
  const challengeCharacter = params.challengeCharacter as string
  const allowsDrawing = params.allowsDrawing === "true"
  const challengeType = params.challengeType as string
  const { success, error2, warning, info } = useAlertContext()

  // Cores disponíveis para desenho
  const colors = ["#000000", "#FF0000", "#0000FF", "#008000", "#FFA500", "#800080", "#FFC0CB"]

  // Espessuras de traço disponíveis
  const strokeWidths = [1, 3, 5, 8]

  // Função para iniciar um novo traço
  const onGestureStateChange = (event: any) => {
    const { nativeEvent } = event
    const { state, x, y } = nativeEvent

    if (state === State.BEGAN) {
      setCurrentPath(`M ${x} ${y}`)
    } else if (state === State.ACTIVE) {
      setCurrentPath((prevPath) => `${prevPath} L ${x} ${y}`)
    } else if (state === State.END) {
      if (currentPath) {
        setPaths([...paths, { path: currentPath, color: currentColor, strokeWidth: currentStrokeWidth }])
        setCurrentPath("")
      }
    }
  }

  // Função para limpar o desenho
  const clearDrawing = () => {
    setPaths([])
    setCurrentPath("")
  }

  // Função melhorada para capturar o desenho como imagem
  const captureDrawing = async (): Promise<string | null> => {
    if (!viewShotRef.current || paths.length === 0) {
      console.log("ViewShot ref não disponível ou não há caminhos para capturar")
      return null
    }

    try {
      console.log("Tentando capturar o desenho...")

      // Verificar se o método capture existe e usá-lo com uma asserção de tipo
      if (viewShotRef.current && typeof viewShotRef.current.capture === "function") {
        const uri = await (viewShotRef.current as any).capture({
          format: "png",
          quality: 1,
          result: "tmpfile",
        })

        console.log("Imagem capturada com sucesso:", uri)
        return uri
      } else {
        console.error("Método capture não disponível no viewShotRef.current")
        return null
      }
    } catch (error) {
      console.error("Erro ao capturar desenho:", error)
      return null
    }
  }

  // Nova função para converter URI para base64
  const uriToBase64 = async (uri: string): Promise<string | null> => {
    try {
      console.log("Convertendo URI para base64:", uri)
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      console.log("Conversão para base64 bem-sucedida, tamanho:", base64.length)
      return base64
    } catch (error) {
      console.error("Erro ao converter URI para base64:", error)
      return null
    }
  }

  // Função melhorada para fazer upload da imagem para o Supabase Storage
  const uploadDrawing = async (uri: string): Promise<string | null> => {
    if (!user) return null

    try {
      console.log("Iniciando upload do desenho...")
      const fileName = `${user.id}_${challengeId}_${Date.now()}.png`
      const filePath = `challenges/${fileName}`

      // Converter URI para base64
      const base64 = await uriToBase64(uri)
      if (!base64) {
        throw new Error("Falha ao converter imagem para base64")
      }

      // Upload para o Supabase Storage usando base64
      const { data, error } = await supabase.storage.from("drawings").upload(filePath, decode(base64), {
        contentType: "image/png",
        upsert: true,
      })

      if (error) {
        console.error("Erro no upload para storage:", error)
        throw error
      }

      console.log("Upload bem-sucedido:", data)

      // Obter URL pública
      const { data: publicUrlData } = supabase.storage.from("drawings").getPublicUrl(filePath)
      console.log("URL pública gerada:", publicUrlData.publicUrl)

      return publicUrlData.publicUrl
    } catch (error) {
      console.error("Erro ao fazer upload do desenho:", error)
      return null
    }
  }

  // Função auxiliar para decodificar base64 para Uint8Array
  function decode(base64: string): Uint8Array {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  }

  // Função auxiliar para atob no React Native
  function atob(data: string): string {
    return global.atob ? global.atob(data) : Buffer.from(data, "base64").toString("binary")
  }

  // Função para completar o desafio
  const completeChallenge = async () => {
    try {
      setLoading(true)

      if (!user) {
        throw new Error("Usuário não autenticado")
      }

      let drawingUrl = null

      // Se permite desenho e há traços, capturar e fazer upload
      if (allowsDrawing && paths.length > 0) {
        console.log("Preparando para capturar e fazer upload do desenho...")
        const capturedUri = await captureDrawing()

        if (capturedUri) {
          console.log("Desenho capturado, iniciando upload...")
          drawingUrl = await uploadDrawing(capturedUri)
          console.log("URL do desenho após upload:", drawingUrl)
        } else {
          console.log("Falha ao capturar o desenho")
        }
      }

      // Verificar se há resposta de texto ou desenho
      if (!allowsDrawing && !responseText.trim()) {
        //Alert.alert("Erro", "Por favor, forneça uma resposta para completar o desafio.")
        error2("Erro ao salvar", "Por favor, forneça uma resposta para completar o desafio.")
        setLoading(false)
        return
      }

      if (allowsDrawing && paths.length === 0) {
        error2("Erro", "Por favor, faça um desenho para completar o desafio.")
        setLoading(false)
        return
      }

      console.log("Salvando desafio completado no banco de dados...")
      console.log("Dados a serem salvos:", {
        user_id: user.id,
        challenge_id: challengeId,
        completed_at: new Date().toISOString(),
        answer: responseText || null,
        drawing_url: drawingUrl,
      })

      // Registrar o desafio como concluído
      const { data, error } = await supabase
        .from("completed_challenges")
        .insert([
          {
            user_id: user.id,
            challenge_id: challengeId,
            completed_at: new Date().toISOString(),
            answer: responseText || null,
            drawing_url: drawingUrl,
          },
        ])
        .select()

      if (error) {
        console.error("Erro ao inserir na tabela:", error)
        throw error
      }

      console.log("Desafio completado com sucesso:", data)

      if(challengeType === "daily") {
        await updateUserPoints(user.id, 1);
        success("Sucesso!", "Desafio Diário concluído com sucesso! Você ganhou 1 ponto!")
      } else if (challengeType === "weekly") {
        await updateUserPoints(user.id, 5);
        success("Sucesso!", "Desafio Semanal concluído com sucesso! Você ganhou 5 pontos!")
      }
      
      setTimeout(() => {
        router.back()
      }, 1500) // Pequeno delay para o usuário ver a mensagem de sucesso
    } catch (error) {
      console.error("Erro ao concluir desafio:", error)
      // Show an error alert
      error2("Erro", "Não foi possível concluir o desafio. Tente novamente mais tarde.")
    } finally {
      setLoading(false)
    }
  }

  // Efeito para verificar se o ViewShot está disponível
  useEffect(() => {
    if (viewShotRef.current) {
      console.log("ViewShot ref está disponível")
    } else {
      console.log("ViewShot ref não está disponível")
    }
  }, [])

  useEffect(() => {
    // Limpa o campo de resposta sempre que o challengeId mudar
    setResponseText("");
  }, [challengeId]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Desafio</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.challengeHeader}>
            <View style={styles.challengeTitleContainer}>
              <Text style={styles.challengeTitle}>{challengeTitle}</Text>
              <Text style={styles.challengeType}>
                {challengeType === "daily" ? "Desafio Diário" : "Desafio Semanal"}
              </Text>
            </View>
            <View style={styles.characterContainer}>
              <Text style={styles.characterEmoji}>{challengeCharacter}</Text>
            </View>
          </View>

          <Text style={styles.challengeText}>{challengeText}</Text>

          {allowsDrawing ? (
            <View style={styles.drawingSection}>
              <Text style={styles.sectionTitle}>Desenhe sua resposta:</Text>

              <View style={styles.drawingTools}>
                <View style={styles.colorPicker}>
                  {colors.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        currentColor === color && styles.selectedColorOption,
                      ]}
                      onPress={() => setCurrentColor(color)}
                    />
                  ))}
                </View>

                <View style={styles.strokeWidthPicker}>
                  {strokeWidths.map((width) => (
                    <TouchableOpacity
                      key={width}
                      style={[
                        styles.strokeWidthOption,
                        currentStrokeWidth === width && styles.selectedStrokeWidthOption,
                      ]}
                      onPress={() => setCurrentStrokeWidth(width)}
                    >
                      <View
                        style={{
                          width: width * 2,
                          height: width,
                          backgroundColor: "#000",
                          borderRadius: width / 2,
                        }}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity style={styles.clearButton} onPress={clearDrawing}>
                <Text style={styles.clearButtonText}>Limpar</Text>
              </TouchableOpacity>

              <ViewShot
                ref={viewShotRef}
                options={{ format: "png", quality: 1 }}
                style={[styles.viewShotContainer, { marginBottom: 16 }]} // Adiciona espaçamento inferior
              >
                <View style={styles.drawingCanvas}>
                  <PanGestureHandler onGestureEvent={onGestureStateChange} onHandlerStateChange={onGestureStateChange}>
                    <Svg height="100%" width="100%" style={styles.svgCanvas}>
                      {paths.map((pathData, index) => (
                        <Path
                          key={index}
                          d={pathData.path}
                          stroke={pathData.color}
                          strokeWidth={pathData.strokeWidth}
                          fill="none"
                        />
                      ))}
                      {currentPath ? (
                        <Path d={currentPath} stroke={currentColor} strokeWidth={currentStrokeWidth} fill="none" />
                      ) : null}
                    </Svg>
                  </PanGestureHandler>
                </View>
              </ViewShot>

              <View style={styles.responseSection}>
                <Text style={styles.sectionTitle}>Escreva sua resposta:</Text>
                <TextInput
                  style={styles.responseInput}
                  multiline
                  placeholder="Digite sua resposta aqui..."
                  placeholderTextColor="#5c5e61"
                  value={responseText}
                  onChangeText={setResponseText}
                  textAlignVertical="top"
                />
              </View>

              {/* Indicador de progresso de upload */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                  <Text style={styles.progressText}>{`${Math.round(uploadProgress)}%`}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.responseSection}>
              <Text style={styles.sectionTitle}>Sua resposta:</Text>
              <TextInput
                style={styles.responseInput}
                multiline
                placeholder="Digite sua resposta aqui..."
                placeholderTextColor="#5c5e61"
                value={responseText}
                onChangeText={setResponseText}
                textAlignVertical="top"
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.completeButton, loading && styles.disabledButton]}
            onPress={completeChallenge}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.completeButtonText}>Concluir Desafio</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  challengeTitleContainer: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 4,
  },
  challengeType: {
    fontSize: 14,
    color: "#6B7280",
  },
  characterContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  characterEmoji: {
    fontSize: 30,
  },
  challengeText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    marginBottom: 16,
  },
  drawingSection: {
    marginBottom: 24,
  },
  drawingTools: {
    marginBottom: 12,
  },
  colorPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 12,
  },
  strokeWidthPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  colorOption: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectedColorOption: {
    borderWidth: 2,
    borderColor: "#111827",
  },
  strokeWidthOption: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: "#F9FAFB",
  },
  selectedStrokeWidthOption: {
    backgroundColor: "#E5E7EB",
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#EF4444",
    borderRadius: 8,
    justifyContent: "center",
    marginBottom: 12,
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    alignItems: "center",
    alignSelf: "center",
    fontSize: 14,
  },
  viewShotContainer: {
    width: "100%",
    height: 300,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    overflow: "hidden",
  },
  drawingCanvas: {
    width: "100%",
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
  },
  svgCanvas: {
    backgroundColor: "#FFFFFF",
  },
  responseSection: {
    marginBottom: 24,
  },
  responseInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    minHeight: 200,
    fontSize: 16,
    color: "#111827",
  },
  completeButton: {
    backgroundColor: "#F163E0",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: "#F8BBF0",
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  progressContainer: {
    marginTop: 8,
    height: 20,
    backgroundColor: "#E5E7EB",
    borderRadius: 10,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#F163E0",
  },
  progressText: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 12,
    lineHeight: 20,
  },
})

export default ChallengeDetailScreen
