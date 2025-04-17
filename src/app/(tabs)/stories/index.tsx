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
  Dimensions,
  SafeAreaView,
  Image,
  Platform,
} from "react-native"
import { useNavigation, type NavigationProp } from "@react-navigation/native"
import type { RootStackParamList } from "../../../types/RootStackParamList"
import { supabase } from "../../../services/supabase"
import { useAuth } from "../../../hooks/useAuth"

interface Story {
  id: string
  title: string
  description: string
  book_cover?: string // Adicionando o campo book_cover
  created_at?: string
}

export default function StoriesScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const user = useAuth()

  // Create a ref to store animation values for each story
  const fadeAnims = useRef<Animated.Value[]>([])
  const slideAnims = useRef<Animated.Value[]>([])

  useEffect(() => {
    fetchStories()
  }, [])

  // This effect runs when stories are updated
  useEffect(() => {
    if (stories.length > 0 && !loading) {
      // Initialize animation values for each story
      fadeAnims.current = stories.map(() => new Animated.Value(0))
      slideAnims.current = stories.map(() => new Animated.Value(50))

      // Create animations for each story with staggered timing
      const animations = stories.map((_, index) => {
        return Animated.parallel([
          Animated.timing(fadeAnims.current[index], {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnims.current[index], {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      })

      // Start animations with staggered delay
      Animated.stagger(100, animations).start()
    }
  }, [stories, loading])

  const fetchStories = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from("stories").select("*").order("created_at", { ascending: true })

      if (error) {
        console.error("Erro ao buscar histórias:", error)
      } else {
        setStories(data || [])
      }
    } catch (error) {
      console.error("Erro em fetchStories:", error)
    } finally {
      setLoading(false)
    }
  }

  // Function to truncate text if it's too long
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F163E0" />
        <Text style={styles.loadingText}>Carregando histórias...</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórias</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchStories}>
          <Text style={styles.refreshButtonText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {stories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Nenhuma história disponível</Text>
            <Text style={styles.emptySubtitle}>Volte mais tarde para novos conteúdos</Text>
          </View>
        ) : (
          stories.map((story, index) => (
            <Animated.View
              key={story.id}
              style={{
                opacity: fadeAnims.current[index] || new Animated.Value(1),
                transform: [
                  {
                    translateY: slideAnims.current[index] || new Animated.Value(0),
                  },
                ],
              }}
            >
              <TouchableOpacity
                style={styles.card}
                onPress={async () => {
                  try {
                    // Get the current user's profile to determine age group
                    const { data: profileData, error: profileError } = await supabase
                      .from("profiles")
                      .select("age_group")
                      .eq("user_id", user?.user?.id)
                      .single()

                    if (profileError) {
                      console.error("Error fetching profile:", profileError)
                      // Navigate with default content if there's an error
                      navigation.navigate("StoryPageScreen", { storyId: story.id })
                      return
                    }

                    // Determine content type based on age group
                    const useChildContent = profileData?.age_group === "05 - 10"

                    console.log(useChildContent)

                    // Navigate with content type parameter
                    navigation.navigate("StoryPageScreen", {
                      storyId: story.id,
                      useChildContent: useChildContent,
                    })
                  } catch (error) {
                    console.error("Error in navigation:", error)
                    // Navigate with default content if there's an error
                    navigation.navigate("StoryPageScreen", { storyId: story.id })
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.storyTitle}>{story.title}</Text>
                  <Text style={styles.storyDescription}>{truncateText(story.description, 120)}</Text>

                  {/* Book Cover Image */}
                  {story.book_cover ? (
                    <View style={styles.bookCoverContainer}>
                      {Platform.OS === "web" ? (
                        <img
                          src={story.book_cover || "/placeholder.svg"}
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
                        <Image source={{ uri: story.book_cover }} style={styles.bookCover} resizeMode="contain" />
                      )}
                    </View>
                  ) : (
                    <View style={styles.bookCoverPlaceholder}>
                      <Text style={styles.bookCoverPlaceholderText}>Sem capa</Text>
                    </View>
                  )}

                  <View style={styles.readMoreContainer}>
                    <Text style={styles.readMoreText}>Leia mais</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>
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
  },
  refreshButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#F163E0",
    borderRadius: 8,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    overflow: "hidden",
  },
  cardContent: {
    padding: 16,
  },
  storyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  storyDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 12,
  },
  // Estilos para a capa do livro
  bookCoverContainer: {
    marginVertical: 12,
    borderRadius: 8,
    overflow: "hidden",
    alignSelf: "center",
    width: "100%",
    height: 180,
    backgroundColor: "#F9FAFB",
  },
  bookCover: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  bookCoverPlaceholder: {
    marginVertical: 12,
    borderRadius: 8,
    width: "100%",
    height: 180,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  bookCoverPlaceholderText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  readMoreContainer: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  readMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F163E0",
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
    textAlign: "center",
  },
})
