import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Dimensions } from "react-native"
import ParentDiaryScreen from "../components/parentDiaryScreen"
import { AlertProvider } from "../components/alert-provider"
import { router } from "expo-router"

// Componente de Diário dos Pais para ser usado no ProfileScreen
const ParentDiary = ({ onClose }: { onClose: () => void }) => {

  return (
    <SafeAreaView style={styles.container}>

      <AlertProvider>
        <ParentDiaryScreen />
      </AlertProvider>
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
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    width: width - 1, // Ajuste para centralizar o título
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
})

export default ParentDiary
