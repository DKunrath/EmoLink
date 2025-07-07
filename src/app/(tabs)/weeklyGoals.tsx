"use client"

import { SafeAreaView } from "react-native-safe-area-context"
import WeeklyGoalsScreen from "../../components/weeklyGoalsScreen"
import { router } from "expo-router"

export default function WeeklyGoalsPage() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <WeeklyGoalsScreen onClose={() => router.back()} />
    </SafeAreaView>
  )
}
