"use client"

import { SafeAreaView } from "react-native-safe-area-context"
import SettingsScreen from "../../components/settingsScreen"
import { router } from "expo-router"

export default function SettingsPage() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <SettingsScreen onClose={() => router.back()} />
    </SafeAreaView>
  )
}
