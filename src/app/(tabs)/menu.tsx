import { View, Text, StyleSheet } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

// Este arquivo é necessário para que a rota "menu" exista,
// mas não será exibido diretamente, pois usamos o botão do menu
// para abrir o sidebar em vez de navegar para esta tela.

export default function MenuScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.text}>Menu</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 18,
    color: "#111827",
  },
})
