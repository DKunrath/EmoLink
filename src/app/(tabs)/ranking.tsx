import { SafeAreaView } from "react-native-safe-area-context"
import LeaderboardScreen from "../../components/leaderboardScreen"

export default function RankingPage() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LeaderboardScreen />
    </SafeAreaView>
  )
}
