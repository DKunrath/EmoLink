"use client";

import { View } from "react-native";
import ChallengesScreen from "./challengesScreen";
import { useNavigation } from "expo-router";
import { useEffect } from "react";

export default function Challenges() {
  const navigation = useNavigation();

  // Configurar as opções de navegação
  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // Oculta o cabeçalho
    });
  }, [navigation]);

  return (
    <View style={{ flex: 1 }}>
      <ChallengesScreen />
    </View>
  );
}