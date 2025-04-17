import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, Animated, SafeAreaView, ScrollView
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Slider from '@react-native-community/slider';
import { diaryService, updateUserPoints } from '../../../services/diary';
import { useAuth } from '../../../contexts/AuthContext';
import { useAlertContext } from "../../../components/alert-provider"
import { supabase } from "../../../services/supabase";

const emotions = {
  happy: { label: 'Feliz', icon: '😊', color: '#4ADE80' },
  excited: { label: 'Animado(a)', icon: '🤗', color: '#F59E0B' },
  sad: { label: 'Triste', icon: '😢', color: '#60A5FA' },
  upset: { label: 'Chateado(a)', icon: '😫', color: '#A78BFA' },
  angry: { label: 'Bravo(a)', icon: '😠', color: '#EF4444' },
  other: { label: 'Outra', icon: '🤔', color: '#6B7280' },
};

export default function EmotionIntensity() {
  const { emotion, description } = useLocalSearchParams();
  const [intensity, setIntensity] = useState(50);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { success, error2, warning, info } = useAlertContext()

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Get emotion details
  const emotionType = emotion as keyof typeof emotions;
  const emotionDetails = emotions[emotionType] || emotions.other;

  useEffect(() => {
    // Animate content in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleSubmit = async () => {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ).toISOString();
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1
    ).toISOString();

    if (!user || !emotion || !description) {
      warning('Aviso', 'Faltam informações. Por favor tente de novo.');
      return;
    }

    try {
      setSaving(true);

      await diaryService.createEntry({
        user_id: user.id,
        emotion_type: emotion as string,
        emotion_description: description as string,
        intensity: intensity
      });

      // 1. Verificar se o usuário já tem entradas no diário hoje
      const { data: diaryData, error: diaryError } = await supabase
        .from("emotion_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("created_at", startOfDay)
        .lt("created_at", endOfDay);

      if (diaryError) {
        throw diaryError;
      }

      if (diaryData && diaryData.length >= 3) {
        // Se já houver 3 registros no dia, não soma pontos
        success("Registro salvo com sucesso, mas limite de pontos diários para registro de emoções atingido.");
        router.replace({
          pathname: '/(tabs)/diary',
          params: { refresh: Date.now().toString() }
        });
      } else
      {
        await updateUserPoints(user.id, 2);
        success("Sucesso!", "Registro salvo com sucesso. Você ganhou 2 pontos!");
        router.replace({
          pathname: '/(tabs)/diary',
          params: { refresh: Date.now().toString() }
        });
      }
    } catch (error) {
      console.error('Error details:', error);
      warning('Erro', 'Falha ao salvar registro. Por favor, tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  // Get intensity label based on value
  const getIntensityLabel = () => {
    if (intensity < 25) return 'Leve';
    if (intensity < 50) return 'Moderada';
    if (intensity < 75) return 'Forte';
    return 'Muito Forte';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.emotionContainer}>
              <Text style={styles.emotionIcon}>{emotionDetails.icon}</Text>
              <Text style={[styles.emotionLabel, { color: emotionDetails.color }]}>
                {emotionDetails.label}
              </Text>
            </View>

            <Text style={styles.title}>Qual a intensidade deste sentimento?</Text>
            <Text style={styles.subtitle}>
              Mova a barra para indicar a intensidade do seu sentimento.
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.intensityContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <View style={styles.percentageContainer}>
              <Text style={[styles.percentageValue, { color: emotionDetails.color }]}>
                {Math.round(intensity)}%
              </Text>
              <Text style={styles.intensityLabel}>
                {getIntensityLabel()}
              </Text>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Fraco</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                value={intensity}
                onValueChange={(value) => {
                  setIntensity(Math.round(value));
                }}
                minimumTrackTintColor={emotionDetails.color}
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor={emotionDetails.color}
              />
              <Text style={styles.sliderLabel}>Forte</Text>
            </View>
          </Animated.View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              disabled={saving}
            >
              <Text style={styles.backButtonText}>Voltar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.saveButton,
                saving && styles.saveButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar Registro</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 40,
  },
  emotionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emotionIcon: {
    fontSize: 32,
    marginRight: 8,
  },
  emotionLabel: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  intensityContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  percentageContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  percentageValue: {
    fontSize: 64,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  intensityLabel: {
    fontSize: 18,
    color: '#4B5563',
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#6B7280',
    width: 40,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: '#F163E0',
    minWidth: 120,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ED77DF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});