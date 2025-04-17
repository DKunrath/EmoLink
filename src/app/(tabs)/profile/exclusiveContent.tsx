"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Image,
} from "react-native"
import { supabase } from "../../../services/supabase"
import { useAuth } from "../../../hooks/useAuth"
import { useAlertContext } from "../../../components/alert-provider"
import VideoScreen from "../../../components/VideoScreen"
import PDFHandler from "../../../components/PdfHandler"

interface VideoItem {
  id: number
  title: string
  description: string
  videoUrl: string
  requiredPoints: number
  thumbnail?: string
}

interface PDFItem {
  id: number
  title: string
  description: string
  pdfUrl: string
  requiredPoints: number
  thumbnail?: string
}

interface ExclusiveContentProps {
  onClose: () => void
}

const ExclusiveContentScreen: React.FC<ExclusiveContentProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(true)
  const [userPoints, setUserPoints] = useState(0)
  const { user } = useAuth()
  const { error2 } = useAlertContext()

  // Lista de vídeos com pontos necessários para desbloqueio
  const videos: VideoItem[] = [
    {
      id: 1,
      title: "A Importância do Cuidador na Educação Emocional do Filho",
      description: "Aprenda a usar a pulseira das emoções para ajudar seu filho a identificar sentimentos.",
      videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//Video_Exclusivo_1.mp4",
      requiredPoints: 0, // Sempre desbloqueado
    },
    {
      id: 2,
      title: "Compreendendo o Ego Infantil e o Papel da Pulseira EmoLink",
      description: "Uma introdução ao universo das emoções e como elas afetam o desenvolvimento infantil.",
      videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//Video_Exclusivo_2.mp4",
      requiredPoints: 10,
    },
    {
      id: 3,
      title: "Como as Relações são formadas",
      description: "Por que não existem emoções negativas e como todas são importantes para o desenvolvimento.",
      videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//Video_Exclusivo_3.mp4",
      requiredPoints: 20,
    },
    {
      id: 4,
      title: "Como Entregar a Pulseira EmoLink para o seu Filho",
      description: "Entenda o medo infantil e como ajudar seu filho a lidar com esse sentimento.",
      videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//Video_Exclusivo_4.mp4",
      requiredPoints: 30,
    },
    {
      id: 5,
      title: "Escutativa",
      description: "Como a tristeza é importante e como ajudar seu filho a processá-la de forma saudável.",
      videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//Video_Exclusivo_5.mp4",
      requiredPoints: 40,
    },
    {
      id: 6,
      title: "Aula sobre a Emo Linguagem",
      description: "Aprenda a explicar a felicidade para crianças usando metáforas simples e eficazes.",
      videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//Video_Exclusivo_6.mp4",
      requiredPoints: 50,
    },
  ]

  // Lista de PDFs com pontos necessários para desbloqueio
  const pdfs: PDFItem[] = [
    {
      id: 1,
      title: "Guia de Educação Emocional",
      description: "Manual completo para pais sobre como utilizar a pulseira EmoLink.",
      pdfUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/pdfs//A_Pulseira_Mgica.pdf",
      requiredPoints: 5,
      thumbnail: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images/pdf_thumbnail_1.png",
    },
    {
      id: 2,
      title: "Atividades Práticas",
      description: "Exercícios para fazer com seu filho para desenvolver inteligência emocional.",
      pdfUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/pdfs//Aventuras_da_Pulseira_Mgica.pdf",
      requiredPoints: 15,
      thumbnail: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/images/pdf_thumbnail_2.png",
    },
  ]

  // Buscar pontos do usuário
  useEffect(() => {
    const fetchUserPoints = async () => {
      try {
        setLoading(true)
        if (!user) return

        const { data, error } = await supabase.from("profiles").select("parent_points").eq("user_id", user.id).single()

        if (error) {
          throw error
        }

        setUserPoints(data?.parent_points || 0)
      } catch (error) {
        console.error("Erro ao buscar pontos:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserPoints()
  }, [user])

  // Verificar se o conteúdo está desbloqueado
  const isContentUnlocked = (content: VideoItem | PDFItem) => {
    return userPoints >= content.requiredPoints
  }

  // Mostrar mensagem para conteúdo bloqueado
  const handleLockedContent = (content: VideoItem | PDFItem) => {
    const pointsNeeded = content.requiredPoints - userPoints
    error2("Conteúdo Bloqueado", `Você precisa de mais ${pointsNeeded} pontos para desbloquear este conteúdo.`)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Conteúdo Exclusivo</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F163E0" />
          <Text style={styles.loadingText}>Carregando conteúdo exclusivo...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Fechar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Conteúdo Exclusivo</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.pointsContainer}>
        <Text style={styles.pointsLabel}>Seus pontos:</Text>
        <Text style={styles.pointsValue}>{userPoints}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Vídeos Educativos</Text>
        <Text style={styles.sectionDescription}>
          Acesse conteúdo exclusivo para ajudar no desenvolvimento emocional do seu filho. Desbloqueie mais vídeos
          conforme acumula pontos.
        </Text>

        <View style={styles.videosGrid}>
          {videos.map((video) => {
            const unlocked = isContentUnlocked(video)

            return (
              <View key={video.id} style={[styles.videoCard, !unlocked && styles.videoCardLocked]}>
                {unlocked ? (
                  <View style={styles.videoContainer}>
                    <VideoScreen videoUrl={video.videoUrl} />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.lockedVideoContainer}
                    onPress={() => handleLockedContent(video)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.thumbnailPlaceholder}>
                      <Text style={styles.thumbnailText}>{video.title.charAt(0)}</Text>
                    </View>
                    <View style={styles.lockOverlay}>
                      <Text style={styles.lockIcon}>🔒</Text>
                      <Text style={styles.requiredPoints}>{video.requiredPoints} pontos</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{video.title}</Text>
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {video.description}
                  </Text>
                </View>
                {unlocked && (
                  <View style={styles.unlockedBadge}>
                    <Text style={styles.unlockedText}>Desbloqueado</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>

        <Text style={styles.sectionTitle}>Materiais em PDF</Text>
        <Text style={styles.sectionDescription}>
          Acesse guias e materiais exclusivos em PDF para aprofundar seus conhecimentos.
        </Text>

        <View style={styles.videosGrid}>
          {pdfs.map((pdf) => {
            const unlocked = isContentUnlocked(pdf)

            return (
              <View key={pdf.id} style={[styles.videoCard, !unlocked && styles.videoCardLocked]}>
                {unlocked ? (
                  <View style={styles.pdfContainer}>
                    {pdf.thumbnail ? (
                      <Image source={{ uri: pdf.thumbnail }} style={styles.pdfThumbnail} resizeMode="cover" />
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <Text style={styles.thumbnailText}>PDF</Text>
                      </View>
                    )}
                    <PDFHandler pdfUrl={pdf.pdfUrl} title={pdf.title} />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.lockedVideoContainer}
                    onPress={() => handleLockedContent(pdf)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.thumbnailPlaceholder}>
                      <Text style={styles.thumbnailText}>PDF</Text>
                    </View>
                    <View style={styles.lockOverlay}>
                      <Text style={styles.lockIcon}>🔒</Text>
                      <Text style={styles.requiredPoints}>{pdf.requiredPoints} pontos</Text>
                    </View>
                  </TouchableOpacity>
                )}

                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{pdf.title}</Text>
                  <Text style={styles.cardDescription} numberOfLines={2}>
                    {pdf.description}
                  </Text>
                </View>
                {unlocked && (
                  <View style={styles.unlockedBadge}>
                    <Text style={styles.unlockedText}>Desbloqueado</Text>
                  </View>
                )}
              </View>
            )
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const { width } = Dimensions.get("window")
const cardWidth = width > 500 ? width / 2 - 24 : width - 32

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
  },
  pointsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  pointsLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4B5563",
    marginRight: 8,
  },
  pointsValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#F163E0",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    marginBottom: 24,
    lineHeight: 20,
  },
  videosGrid: {
    flexDirection: "column",
  },
  videoCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    overflow: "hidden",
  },
  videoCardLocked: {
    opacity: 0.9,
  },
  videoContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  pdfContainer: {
    width: "100%",
  },
  pdfThumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  lockedVideoContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    position: "relative",
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F163E0",
    aspectRatio: 16 / 9,
  },
  thumbnailText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  lockOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  lockIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  requiredPoints: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  unlockedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#10B981",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  unlockedText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  cardContent: {
    padding: 16,
    position: "relative",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
})

export default ExclusiveContentScreen
