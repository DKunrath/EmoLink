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
  Platform,
  Image,
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
//import { updateUserPoints } from '../../services/diary';
import { updateUserPoints } from '../../services/pointsService';
import FeedbackModal from '../../components/FeedbackModal';
import { useFeedbackModal } from '../../hooks/useFeedbackModal';
import { Character } from '../../types/feedback-modal';
import { usePointsHistorySubscription } from '../../hooks/usePointsHistorySubscription';

interface PathData {
  path: string
  color: string
  strokeWidth: number
}

interface Characters {
  name: string
  id: string
  image: string
}

// Lista de personagens disponíveis
const charactersImages: Characters[] = [
  { name: "Amy", id: "amy", image: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Amy.png" },
  { name: "Angelita", id: "angelita", image: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Angelita.png" },
  { name: "Grãozinho", id: "graozinho", image: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Angelita.png" },
  { name: "Lili", id: "lili", image: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Angelita.png" },
]

const ChallengeDetailScreen = () => {
  const params = useLocalSearchParams()
  const navigation = useNavigation()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [responseText, setResponseText] = useState("")
  const [responseText2, setResponseText2] = useState("")
  const [paths, setPaths] = useState<PathData[]>([])
  const [paths2, setPaths2] = useState<PathData[]>([]) // Paths for parent drawing
  const [currentPath, setCurrentPath] = useState<string>("")
  const [currentPath2, setCurrentPath2] = useState<string>("") // Current path for parent drawing
  const [currentColor, setCurrentColor] = useState<string>("#000000")
  const [currentColor2, setCurrentColor2] = useState<string>("#000000") // Color for parent drawing
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState<number>(3)
  const [currentStrokeWidth2, setCurrentStrokeWidth2] = useState<number>(3) // Stroke width for parent drawing
  const [uploadProgress, setUploadProgress] = useState(0)
  const [activeDrawingCanvas, setActiveDrawingCanvas] = useState<1 | 2>(1) // Track which canvas is active
  const viewShotRef = useRef<ViewShot>(null)
  const viewShotRef2 = useRef<ViewShot>(null) // Ref for parent drawing

  const challengeId = params.challengeId as string
  const challengeTitle = params.challengeTitle as string
  const challengeText = params.challengeText as string
  const challengeCharacter = params.challengeCharacter as string
  const allowsDrawing = params.allowsDrawing === "true"
  const challengeType = params.challengeType as string
  const { error2 } = useAlertContext()
  const isParentChallenge = challengeType === "parents"

  const { modalState, showFeedbackModal, hideFeedbackModal } = useFeedbackModal();
  // Configurar subscrições para o histórico de pontos quando o usuário estiver autenticado
  //usePointsHistorySubscription(user?.id);

  const onTaskComplete = (points: number) => {
    // Lista de personagens
    const characters: Character[] = ['amy', 'angelita', 'graozinho'];

    // Lista de mensagens motivacionais
    const motivationalDailyMessages = [
      'Parabéns! Você concluiu seu desafio diário com sucesso!',
      'Fantástico! Seu esforço diário está valendo a pena!',
      'Excelente trabalho! Você está construindo um hábito incrível!',
      'Incrível! Cada dia concluído é um passo para o seu progresso!',
      'Você é incrível! Continue vencendo seus desafios diários!',
    ];

    const motivationalWeeklyMessages = [
      'Parabéns! Você concluiu seu desafio semanal com sucesso!',
      'Fantástico! Sua dedicação durante a semana foi recompensada!',
      'Excelente trabalho! Você superou mais um desafio semanal!',
      'Incrível! Cada semana concluída é um grande passo para o seu crescimento!',
      'Você é incrível! Continue conquistando seus objetivos semanais!',
    ];

    const motivationalParentMessages = [
      'Parabéns! Você e seus pais concluíram este desafio juntos!',
      'Fantástico! Trabalhar em equipe com sua família é incrível!',
      'Excelente trabalho! Vocês superaram este desafio como uma equipe!',
      'Incrível! Cada desafio concluído juntos fortalece seus laços familiares!',
      'Vocês são incríveis! Continuem conquistando objetivos juntos!',
    ];

    // Função para selecionar um item aleatório de uma lista
    const getRandomCharacter = (list: Character[]) => {
      return list[Math.floor(Math.random() * list.length)];
    };

    const getRandomDailyMessage = (list: string[]) => {
      return list[Math.floor(Math.random() * list.length)];
    };

    const getRandomWeeklyMessage = (list: string[]) => {
      return list[Math.floor(Math.random() * list.length)];
    };

    const getRandomParentMessage = (list: string[]) => {
      return list[Math.floor(Math.random() * list.length)];
    };

    if (points === 1) {
      // Selecionar personagem e mensagem aleatórios
      const randomCharacter = getRandomCharacter(characters);
      const randomMessage = getRandomDailyMessage(motivationalDailyMessages);

      // Mostrar o modal de feedback
      showFeedbackModal(
        randomCharacter, // personagem aleatório
        randomMessage, // mensagem motivacional aleatória
        points, // pontos ganhos
        'challenge' // tipo: 'challenge' | 'diary' | 'goal' | 'story'
      );
    }
    else if (points === 5) {
      // Selecionar personagem e mensagem aleatórios
      const randomCharacter = getRandomCharacter(characters);
      const randomMessage = getRandomWeeklyMessage(motivationalWeeklyMessages);

      // Mostrar o modal de feedback
      showFeedbackModal(
        randomCharacter, // personagem aleatório
        randomMessage, // mensagem motivacional aleatória
        points, // pontos ganhos
        'challenge' // tipo: 'challenge' | 'diary' | 'goal' | 'story'
      );
    }
    else if (points === 10) {
      // Selecionar personagem e mensagem aleatórios
      const randomCharacter = getRandomCharacter(characters);
      const randomMessage = getRandomParentMessage(motivationalParentMessages);

      // Mostrar o modal de feedback
      showFeedbackModal(
        randomCharacter, // personagem aleatório
        randomMessage, // mensagem motivacional aleatória
        points, // pontos ganhos
        'challenge' // tipo: 'challenge' | 'diary' | 'goal' | 'story'
      );
    }
  };

  const handleCloseModal = () => {
    hideFeedbackModal();
    navigation.goBack()
  };

  // Cores disponíveis para desenho
  const colors = ["#000000", "#FF0000", "#0000FF", "#008000", "#FFA500", "#800080", "#FFC0CB"]

  // Espessuras de traço disponíveis
  const strokeWidths = [1, 3, 5, 8]

  // Função para iniciar um novo traço no canvas 1 (criança)
  const onGestureStateChange = (event: any) => {
    const { nativeEvent } = event
    const { state, x, y } = nativeEvent

    if (activeDrawingCanvas !== 1) return

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

  // Função para iniciar um novo traço no canvas 2 (pais)
  const onGestureStateChange2 = (event: any) => {
    const { nativeEvent } = event
    const { state, x, y } = nativeEvent

    if (activeDrawingCanvas !== 2) return

    if (state === State.BEGAN) {
      setCurrentPath2(`M ${x} ${y}`)
    } else if (state === State.ACTIVE) {
      setCurrentPath2((prevPath) => `${prevPath} L ${x} ${y}`)
    } else if (state === State.END) {
      if (currentPath2) {
        setPaths2([...paths2, { path: currentPath2, color: currentColor2, strokeWidth: currentStrokeWidth2 }])
        setCurrentPath2("")
      }
    }
  }

  // Função para limpar o desenho da criança
  const clearDrawing = () => {
    setPaths([])
    setCurrentPath("")
  }

  // Função para limpar o desenho dos pais
  const clearDrawing2 = () => {
    setPaths2([])
    setCurrentPath2("")
  }

  // Função melhorada para capturar o desenho como imagem
  // Modify the captureDrawing function to handle the correct types
  const captureDrawing = async (ref: React.RefObject<any>, pathsArray: PathData[]): Promise<string | null> => {
    if (!ref.current || pathsArray.length === 0) {
      return null
    }

    try {
      // Verificar se o método capture existe e usá-lo
      if (ref.current && typeof ref.current.capture === "function") {
        const uri = await ref.current.capture({
          format: "png",
          quality: 1,
          result: "tmpfile",
        })

        return uri
      } else {
        return null
      }
    } catch (error) {
      return null
    }
  }

  // Nova função para converter URI para base64
  const uriToBase64 = async (uri: string): Promise<string | null> => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      return base64
    } catch (error) {
      return null
    }
  }

  // Função melhorada para fazer upload da imagem para o Supabase Storage
  const uploadDrawing = async (uri: string, suffix: string = ""): Promise<string | null> => {
    if (!user) return null

    try {
      const fileName = `${user.id}_${challengeId}${suffix}_${Date.now()}.png`
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
        throw error
      }

      // Obter URL pública
      const { data: publicUrlData } = supabase.storage.from("drawings").getPublicUrl(filePath)

      return publicUrlData.publicUrl
    } catch (error) {
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
      let drawingUrl2 = null

      // Validações específicas para desafios de pais
      if (isParentChallenge) {
        if (!allowsDrawing && (!responseText.trim() || !responseText2.trim())) {
          error2("Erro ao salvar", "Por favor, forneça respostas tanto da criança quanto dos pais para completar o desafio.")
          setLoading(false)
          return
        }

        if (allowsDrawing) {
          // Verificar se ambos os desenhos foram feitos para desafios de pais
          if (paths.length === 0) {
            error2("Erro", "Por favor, faça o desenho da criança para completar o desafio.")
            setLoading(false)
            return
          }

          if (paths2.length === 0) {
            error2("Erro", "Por favor, faça o desenho dos pais para completar o desafio.")
            setLoading(false)
            return
          }

          // Capturar e fazer upload de ambos os desenhos
          const capturedUri = await captureDrawing(viewShotRef, paths)
          const capturedUri2 = await captureDrawing(viewShotRef2, paths2)

          if (capturedUri) {
            drawingUrl = await uploadDrawing(capturedUri, "_child")
          }

          if (capturedUri2) {
            drawingUrl2 = await uploadDrawing(capturedUri2, "_parent")
          }

          if (!drawingUrl || !drawingUrl2) {
            error2("Erro", "Falha ao processar os desenhos. Tente novamente.")
            setLoading(false)
            return
          }
        }
      } else {
        // Validações para desafios normais
        if (!allowsDrawing && !responseText.trim()) {
          error2("Erro ao salvar", "Por favor, forneça uma resposta para completar o desafio.")
          setLoading(false)
          return
        }

        if (allowsDrawing && paths.length === 0) {
          error2("Erro", "Por favor, faça um desenho para completar o desafio.")
          setLoading(false)
          return
        }

        // Se permite desenho e há traços, capturar e fazer upload
        if (allowsDrawing && paths.length > 0) {
          const capturedUri = await captureDrawing(viewShotRef, paths)

          if (capturedUri) {
            drawingUrl = await uploadDrawing(capturedUri)
          } else {
            error2("Erro", "Falha ao processar o desenho. Tente novamente.")
            setLoading(false)
            return
          }
        }
      }

      // Registrar o desafio como concluído
      const { data, error } = await supabase
        .from("completed_challenges")
        .insert([
          {
            user_id: user.id,
            challenge_id: challengeId,
            completed_at: new Date().toISOString(),
            answer: responseText || null,
            answer_2: responseText2 || null,
            drawing_url: drawingUrl,
            drawing_url_2: drawingUrl2,
            challenge_type: challengeType,
          },
        ])
        .select()

      if (error) {
        throw error
      }

      if (challengeType === "daily") {
        await updateUserPoints(user.id, 1, "daily_challenge", "Desafio diário completado");
        onTaskComplete(1); // Chama a função para mostrar o modal de feedback

      } else if (challengeType === "weekly") {
        await updateUserPoints(user.id, 5, "weekly_challenge", "Desafio semanal completado");
        onTaskComplete(5); // Chama a função para mostrar o modal de feedback
      } else if (challengeType === "parents") {
        await updateUserPoints(user.id, 10, "family_challenge", "Desafio familiar completado");
        onTaskComplete(10); // Chama a função para mostrar o modal de feedback
      }
    } catch (error) {
      // Show an error alert
      error2("Erro", "Não foi possível concluir o desafio. Tente novamente mais tarde.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Limpa o campo de resposta sempre que o challengeId mudar
    setResponseText("");
    setResponseText2("");
    setPaths([]);
    setPaths2([]);
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
                {(() => {
                  switch (challengeType) {
                    case "daily":
                      return "Desafio Diário";
                    case "weekly":
                      return "Desafio Semanal";
                    case "parents":
                      return "Desafio Familiar";
                    default:
                      return "Desafio";
                  }
                })()}
              </Text>
            </View>
            <View style={styles.characterContainer}>
              {Platform.OS === "web" && challengeCharacter === "Amy" ? (
                <img
                  src={charactersImages[0].image}
                  alt=""
                  style={styles.avatar}
                />
              ) : challengeCharacter === "Amy" && (
                <Image
                  source={{ uri: charactersImages[0].image }}
                  style={styles.avatar}
                  resizeMode="contain"
                />
              )}

              {Platform.OS === "web" && challengeCharacter === "Angelita" ? (
                <img
                  src={charactersImages[1].image}
                  alt=""
                  style={styles.avatar}
                />
              ) : challengeCharacter === "Angelita" && (
                <Image
                  source={{ uri: charactersImages[1].image }}
                  style={styles.avatar}
                  resizeMode="contain"
                />
              )}

              {Platform.OS === "web" && challengeCharacter === "Grãozinho" ? (
                <img
                  src={charactersImages[2].image}
                  alt=""
                  style={styles.avatar}
                />
              ) : challengeCharacter === "Grãozinho" && (
                <Image
                  source={{ uri: charactersImages[2].image }}
                  style={styles.avatar}
                  resizeMode="contain"
                />
              )}

              {Platform.OS === "web" && challengeCharacter === "Lili" ? (
                <img
                  src={charactersImages[3].image}
                  alt=""
                  style={styles.avatar}
                />
              ) : challengeCharacter === "Lili" && (
                <Image
                  source={{ uri: charactersImages[3].image }}
                  style={styles.avatar}
                  resizeMode="contain"
                />
              )}
            </View>
          </View>

          <Text style={styles.challengeText}>{challengeText}</Text>

          {allowsDrawing ? (
            <View style={styles.drawingSection}>
              {/* Desenho da criança */}
              <Text style={styles.sectionTitle}>
                {isParentChallenge ? "Desenho da Criança:" : "Desenhe sua resposta:"}
              </Text>

              <View style={styles.drawingTools}>
                <View style={styles.colorPicker}>
                  {colors.map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        activeDrawingCanvas === 1 && currentColor === color && styles.selectedColorOption,
                      ]}
                      onPress={() => {
                        setCurrentColor(color);
                        setActiveDrawingCanvas(1);
                      }}
                    />
                  ))}
                </View>

                <View style={styles.strokeWidthPicker}>
                  {strokeWidths.map((width) => (
                    <TouchableOpacity
                      key={width}
                      style={[
                        styles.strokeWidthOption,
                        activeDrawingCanvas === 1 && currentStrokeWidth === width && styles.selectedStrokeWidthOption,
                      ]}
                      onPress={() => {
                        setCurrentStrokeWidth(width);
                        setActiveDrawingCanvas(1);
                      }}
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

              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearDrawing}
              >
                <Text style={styles.clearButtonText}>Limpar</Text>
              </TouchableOpacity>

              <ViewShot
                ref={viewShotRef}
                options={{ format: "png", quality: 1 }}
                style={[styles.viewShotContainer, { marginBottom: 16 }]}
              >
                <View
                  style={[
                    styles.drawingCanvas,
                    activeDrawingCanvas === 1 && styles.activeDrawingCanvas
                  ]}
                  onTouchStart={() => setActiveDrawingCanvas(1)}
                >
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

              {/* Desenho dos pais (apenas para desafios de pais) */}
              {isParentChallenge && (
                <>
                  <Text style={styles.sectionTitle}>Desenho dos Pais:</Text>

                  <View style={styles.drawingTools}>
                    <View style={styles.colorPicker}>
                      {colors.map((color) => (
                        <TouchableOpacity
                          key={color}
                          style={[
                            styles.colorOption,
                            { backgroundColor: color },
                            activeDrawingCanvas === 2 && currentColor2 === color && styles.selectedColorOption,
                          ]}
                          onPress={() => {
                            setCurrentColor2(color);
                            setActiveDrawingCanvas(2);
                          }}
                        />
                      ))}
                    </View>

                    <View style={styles.strokeWidthPicker}>
                      {strokeWidths.map((width) => (
                        <TouchableOpacity
                          key={width}
                          style={[
                            styles.strokeWidthOption,
                            activeDrawingCanvas === 2 && currentStrokeWidth2 === width && styles.selectedStrokeWidthOption,
                          ]}
                          onPress={() => {
                            setCurrentStrokeWidth2(width);
                            setActiveDrawingCanvas(2);
                          }}
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

                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={clearDrawing2}
                  >
                    <Text style={styles.clearButtonText}>Limpar</Text>
                  </TouchableOpacity>

                  <ViewShot
                    ref={viewShotRef2}
                    options={{ format: "png", quality: 1 }}
                    style={[styles.viewShotContainer, { marginBottom: 16 }]}
                  >
                    <View
                      style={[
                        styles.drawingCanvas,
                        activeDrawingCanvas === 2 && styles.activeDrawingCanvas
                      ]}
                      onTouchStart={() => setActiveDrawingCanvas(2)}
                    >
                      <PanGestureHandler onGestureEvent={onGestureStateChange2} onHandlerStateChange={onGestureStateChange2}>
                        <Svg height="100%" width="100%" style={styles.svgCanvas}>
                          {paths2.map((pathData, index) => (
                            <Path
                              key={index}
                              d={pathData.path}
                              stroke={pathData.color}
                              strokeWidth={pathData.strokeWidth}
                              fill="none"
                            />
                          ))}
                          {currentPath2 ? (
                            <Path d={currentPath2} stroke={currentColor2} strokeWidth={currentStrokeWidth2} fill="none" />
                          ) : null}
                        </Svg>
                      </PanGestureHandler>
                    </View>
                  </ViewShot>
                </>
              )}

              {/* Resposta em texto da criança */}
              <View style={styles.responseSection}>
                <Text style={styles.sectionTitle}>
                  {isParentChallenge ? "Resposta da Criança:" : "Escreva sua resposta:"}
                </Text>
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

              {/* Resposta em texto dos pais (apenas para desafios de pais) */}
              {isParentChallenge && (
                <View style={styles.responseSection}>
                  <Text style={styles.sectionTitle}>Resposta dos Pais:</Text>
                  <TextInput
                    style={styles.responseInput}
                    multiline
                    placeholder="Digite a resposta dos pais aqui..."
                    placeholderTextColor="#5c5e61"
                    value={responseText2}
                    onChangeText={setResponseText2}
                    textAlignVertical="top"
                  />
                </View>
              )}

              {/* Indicador de progresso de upload */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
                  <Text style={styles.progressText}>{`${Math.round(uploadProgress)}%`}</Text>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* Resposta em texto da criança para desafios sem desenho */}
              <View style={styles.responseSection}>
                <Text style={styles.sectionTitle}>
                  {isParentChallenge ? "Resposta da Criança:" : "Sua resposta:"}
                </Text>
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

              {/* Resposta em texto dos pais para desafios sem desenho (apenas para desafios de pais) */}
              {isParentChallenge && (
                <View style={styles.responseSection}>
                  <Text style={styles.sectionTitle}>Resposta dos Pais:</Text>
                  <TextInput
                    style={styles.responseInput}
                    multiline
                    placeholder="Digite a resposta dos pais aqui..."
                    placeholderTextColor="#5c5e61"
                    value={responseText2}
                    onChangeText={setResponseText2}
                    textAlignVertical="top"
                  />
                </View>
              )}
            </>
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
        {/* Modal de Feedback */}
        <FeedbackModal
          visible={modalState.visible}
          onClose={handleCloseModal}
          character={modalState.character}
          message={modalState.message}
          points={modalState.points}
          taskType={modalState.taskType}
        />
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
  activeDrawingCanvas: {
    borderColor: "#F163E0",
    borderWidth: 2,
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
    avatar: {
    width: "100%",
    height: "100%",
  },
})

export default ChallengeDetailScreen
