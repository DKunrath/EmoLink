"use client"
import { SafeAreaView } from "react-native-safe-area-context"
import ParentDiary from "../../components/parentDiary"
import { router } from "expo-router"

export default function ParentAccessPage() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ParentDiary onClose={() => router.back()} />
    </SafeAreaView>
  )
}
