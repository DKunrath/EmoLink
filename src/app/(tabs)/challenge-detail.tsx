"use client"

import { View } from "react-native"
import ChallengeDetailScreen from "./challengeDetailScreen"
import { useNavigation } from "expo-router";
import { useEffect } from "react";

export default function ChallengeDetail() {
  const navigation = useNavigation();

  // Configurar as opções de navegação
  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // Oculta o cabeçalho
    });
  }, [navigation]);
  
  return (
    <View style={{ flex: 1 }}>
      <ChallengeDetailScreen />
    </View>
  )
}
