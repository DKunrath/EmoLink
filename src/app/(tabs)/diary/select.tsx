import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Animated, Dimensions, SafeAreaView, ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';

const emotions = [
  { id: 'happy', label: 'Feliz', icon: '😊', color: '#4ADE80' },
  { id: 'excited', label: 'Animado(a)', icon: '🤗', color: '#F59E0B' },
  { id: 'sad', label: 'Triste', icon: '😢', color: '#60A5FA' },
  { id: 'upset', label: 'Chateado(a)', icon: '😫', color: '#A78BFA' },
  { id: 'angry', label: 'Bravo(a)', icon: '😠', color: '#EF4444' },
  { id: 'other', label: 'Outra', icon: '🤔', color: '#6B7280' },
];

export default function EmotionSelection() {
  const { user } = useAuth();
  const [fadeAnims] = useState(() => 
    emotions.map(() => new Animated.Value(0))
  );

  useEffect(() => {
    if (!user) {
      router.replace('/(auth)/sign-in');
    }
  }, [user]);

  useEffect(() => {
    // Staggered animation for emotion buttons
    emotions.forEach((_, index) => {
      Animated.timing(fadeAnims[index], {
        toValue: 1,
        duration: 400,
        delay: 100 + (index * 100),
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const handleEmotionSelect = (emotion: string) => {
    router.push({
      pathname: '/(tabs)/diary/description',
      params: { emotion }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Como você está se sentindo?</Text>
          
          <View style={styles.grid}>
            {emotions.map((emotion, index) => (
              <Animated.View 
                key={emotion.id}
                style={[
                  styles.buttonContainer,
                  { 
                    opacity: fadeAnims[index],
                    transform: [{ 
                      translateY: fadeAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0]
                      }) 
                    }]
                  }
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleEmotionSelect(emotion.id)}
                  style={[styles.emotionButton, { backgroundColor: emotion.color + '15' }]} // 15 is hex for 10% opacity
                  activeOpacity={0.7}
                >
                  <Text style={styles.emotionIcon}>{emotion.icon}</Text>
                  <Text style={[styles.emotionLabel, { color: emotion.color }]}>
                    {emotion.label}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const buttonWidth = (width - 48) / 2; // 48 = padding (16) * 2 + gap between buttons (16)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  buttonContainer: {
    width: buttonWidth,
    marginBottom: 16,
  },
  emotionButton: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  emotionIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emotionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 'auto',
    alignSelf: 'center',
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
  scrollContent: {
    flexGrow: 1,
  },
});