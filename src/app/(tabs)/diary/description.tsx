import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, Animated, SafeAreaView,
  KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';

const emotions = {
  happy: { label: 'Feliz', icon: '😊', color: '#4ADE80' },
  excited: { label: 'Animado(a)', icon: '🤗', color: '#F59E0B' },
  sad: { label: 'Triste', icon: '😢', color: '#60A5FA' },
  upset: { label: 'Chateado(a)', icon: '😫', color: '#A78BFA' },
  angry: { label: 'Bravo(a)', icon: '😠', color: '#EF4444' },
  other: { label: 'Outra', icon: '🤔', color: '#6B7280' },
};

export default function EmotionDescription() {
  const { emotion } = useLocalSearchParams();
  const [description, setDescription] = useState('');
  const { user } = useAuth();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Get emotion details
  const emotionType = emotion as keyof typeof emotions;
  const emotionDetails = emotions[emotionType] || emotions.other;

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/sign-in');
    }
  }, [user]);

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
      })
    ]).start();
  }, []);

  const handleNext = () => {
    router.push({
      pathname: '/(tabs)/diary/intensity',
      params: {
        emotion: emotion as string,
        description: description
      }
    });
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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

              <Text style={styles.title}>Nos conte mais sobre</Text>
              <Text style={styles.subtitle}>
                O que fez você se sentir assim? Descreva a experiência em detalhes.
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.inputContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <TextInput
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="Eu me sinto assim porque..."
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                textAlignVertical="top"
              />
            </Animated.View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
              >
                <Text style={styles.backButtonText}>Voltar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.nextButton,
                  !description.trim() && styles.nextButtonDisabled
                ]}
                onPress={handleNext}
                disabled={!description.trim()}
              >
                <Text style={styles.nextButtonText}>Próximo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
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
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  inputContainer: {
    flex: 1,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    height: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
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
  nextButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    backgroundColor: '#F163E0',
  },
  nextButtonDisabled: {
    backgroundColor: '#ED77DF',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});