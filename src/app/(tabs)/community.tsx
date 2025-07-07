"use client"
import { SafeAreaView } from "react-native-safe-area-context"
import CommunityScreen from "../../components/communityScreen"

export default function InstructionsPage() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <CommunityScreen onClose={() => {}} />
    </SafeAreaView>
  )
}