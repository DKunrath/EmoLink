"use client"
import { SafeAreaView } from "react-native-safe-area-context"
import ExclusiveContentScreen from "../../components/exclusiveContent"
import { router } from "expo-router"

export default function ExclusiveContentPage() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ExclusiveContentScreen onClose={() => router.back()} />
    </SafeAreaView>
  )
}
