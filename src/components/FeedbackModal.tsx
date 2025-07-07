"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  type ImageSourcePropType,
} from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import LottieView from "lottie-react-native"

// Definindo os tipos para as propriedades do componente
interface FeedbackModalProps {
  visible: boolean
  onClose: () => void
  character: "amy" | "angelita" | "graozinho"
  message: string
  points: number
  taskType?: "challenge" | "diary" | "goal" | "story"
}

// Mapeamento de personagens para imagens
const characterImages = {
  amy: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Amy.png",
  angelita: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Angelita.png",
  graozinho: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images//image_Angelita.png",
}

// Mapeamento de tipos de tarefas para ícones e cores
const taskTypeConfig = {
  challenge: {
    icon: "trophy",
    color: "#FFD700", // Dourado
    confetti: require("../assets/animations/confetti-gold.json"),
  },
  diary: {
    icon: "book-open-variant",
    color: "#4CAF50", // Verde
    confetti: require("../assets/animations/confetti-green.json"),
  },
  goal: {
    icon: "flag-checkered",
    color: "#2196F3", // Azul
    confetti: require("../assets/animations/confetti-blue.json"),
  },
  story: {
    icon: "emoticon-outline",
    color: "#F163E0", // Rosa
    confetti: require("../assets/animations/confetti-pink.json"),
  },
}

const { width } = Dimensions.get("window")

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  onClose,
  character,
  message,
  points,
  taskType = "challenge",
}) => {
  // Animações
  const scaleAnim = useRef(new Animated.Value(0.5)).current
  const opacityAnim = useRef(new Animated.Value(0)).current
  const bounceAnim = useRef(new Animated.Value(0)).current
  const spinAnim = useRef(new Animated.Value(0)).current

  // Referência para a animação Lottie
  const lottieRef = useRef<LottieView>(null)

  useEffect(() => {
    if (visible) {
      // Resetar animações
      scaleAnim.setValue(0.5)
      opacityAnim.setValue(0)
      bounceAnim.setValue(0)
      spinAnim.setValue(0)

      // Iniciar sequência de animações
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start()

      // Animação de rotação contínua para os pontos
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ).start()

      // Iniciar animação de confete
      if (lottieRef.current) {
        lottieRef.current.play()
      }
    }
  }, [visible, scaleAnim, opacityAnim, bounceAnim, spinAnim])

  // Calcular a animação de salto
  const bounceInterpolation = bounceAnim.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: [0, 10, -8, 6, -4, 0],
  })

  // Calcular a animação de rotação
  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  })

  // Obter configuração com base no tipo de tarefa
  const config = taskTypeConfig[taskType]

  // Função para renderizar a imagem do personagem com fallback
  const renderCharacterImage = () => {
    const source = { uri: characterImages[character] }; // Cria o objeto de fonte com a URL
  
    return (
      <Image
        source={source}
        style={styles.characterImage}
        resizeMode="contain"
        onError={(error) => {
          // Renderiza um fallback se a imagem falhar
          return (
            <View style={styles.characterFallback}>
              <MaterialCommunityIcons name="emoticon-happy-outline" size={100} color="#F9F9F9" />
            </View>
          );
        }}
      />
    );
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Animação de confete */}
        {Platform.OS !== "web" && (
          <LottieView ref={lottieRef} source={config.confetti} style={styles.confetti} loop={false} autoPlay={false} />
        )}

        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }, { translateY: bounceInterpolation }],
            },
          ]}
        >
          {/* Cabeçalho do modal */}
          <View style={[styles.modalHeader, { backgroundColor: config.color }]}>
            <MaterialCommunityIcons name={config.icon as any} size={32} color="#FFFFFF" />
            <Text style={styles.headerText}>Parabéns!</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Conteúdo do modal */}
          <View style={styles.modalContent}>
            {/* Personagem */}
            <View style={styles.characterContainer}>{renderCharacterImage()}</View>

            {/* Mensagem */}
            <View style={styles.messageContainer}>
              <Text style={styles.message}>{message}</Text>
            </View>

            {/* Pontos */}
            <View style={styles.pointsContainer}>
              <Text style={styles.pointsLabel}>Você ganhou</Text>
              <View style={styles.pointsWrapper}>
                <Animated.View
                  style={[
                    styles.pointsBadge,
                    {
                      backgroundColor: config.color,
                      transform: [{ rotate: spinInterpolation }],
                    },
                  ]}
                >
                  <Text style={styles.pointsValue}>{points}</Text>
                </Animated.View>
                <Text style={styles.pointsText}>pontos!</Text>
              </View>
            </View>

            {/* Botão de continuar */}
            <TouchableOpacity style={[styles.continueButton, { backgroundColor: config.color }]} onPress={onClose}>
              <Text style={styles.continueButtonText}>Continuar</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Decorações */}
          <View style={styles.decorations}>
            {[...Array(5)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.decoration,
                  {
                    top: Math.random() * 200,
                    left: Math.random() * width * 0.8,
                    backgroundColor: config.color,
                    opacity: 0.2 + Math.random() * 0.3,
                    transform: [{ rotate: `${Math.random() * 360}deg` }],
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 20,
  },
  confetti: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  modalContainer: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginLeft: 10,
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  modalContent: {
    padding: 20,
    alignItems: "center",
  },
  characterContainer: {
    marginVertical: 10,
    alignItems: "center",
  },
  characterImage: {
    width: 150,
    height: 150,
  },
  characterFallback: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9F9F9",
    borderRadius: 75,
  },
  messageContainer: {
    marginVertical: 15,
    alignItems: "center",
  },
  message: {
    fontSize: 18,
    color: "#333",
    textAlign: "center",
    lineHeight: 24,
  },
  pointsContainer: {
    alignItems: "center",
    marginVertical: 15,
  },
  pointsLabel: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  pointsWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  pointsBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  pointsValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  pointsText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    marginTop: 15,
    width: "80%",
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginRight: 8,
  },
  decorations: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: -1,
  },
  decoration: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 4,
  },
})

export default FeedbackModal
