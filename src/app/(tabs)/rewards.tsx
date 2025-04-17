"use client"

import { View } from "react-native"
import RewardsScreen from "./rewardsScreen"
import { useNavigation } from "expo-router";
import { useEffect } from "react";

export default function Rewards() {
    const navigation = useNavigation();

      // Configurar as opções de navegação
  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // Oculta o cabeçalho
    });
  }, [navigation]);
  
  return (
    <View style={{ flex: 1 }}>
      <RewardsScreen />
    </View>
  )
}
