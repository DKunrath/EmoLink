"use client"
import EmotionGraphsScreen from "../../components/emotionGraphsScreen"
import { useRouter } from "expo-router"

export default function EmotionGraphs() {
  const router = useRouter()

  const handleClose = () => {
    router.back()
  }

  return <EmotionGraphsScreen onClose={handleClose} />
}
