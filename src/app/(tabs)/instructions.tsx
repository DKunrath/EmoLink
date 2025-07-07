"use client"
import { SafeAreaView } from "react-native-safe-area-context"
import InstructionsScreen from "../../components/InstructionsScreen"

export default function InstructionsPage() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <InstructionsScreen onClose={() => {}} />
    </SafeAreaView>
  )
}