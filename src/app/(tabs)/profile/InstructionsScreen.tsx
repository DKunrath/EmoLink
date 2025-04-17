"use client"

import type React from "react"
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
} from "react-native"
import { useState, useRef } from "react"
import VideoScreen from "../../../components/VideoScreen";

interface InstructionsScreenProps {
  onClose: () => void
}

const InstructionsScreen: React.FC<InstructionsScreenProps> = ({ onClose }) => {

  // Vídeos de instrução
  const instructionVideos = [
    { id: 1, title: "Pulseira das Emoções Aula 1", videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//pulseira_das_emocoes_aula_1.mp4" },
    { id: 2, title: "O Mundo das Emoções", videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//o_mundo_das_emocoes.mp4" },
    { id: 3, title: "Mito das Emoções Negativas", videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//mitos_das_emocoes_negativas.mp4" },
    { id: 4, title: "Conceito de Medo", videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//conceito_de_medo.mp4" },
    { id: 5, title: "A Tristeza", videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//a_tristeza.mp4" },
    { id: 6, title: "Metáfora da Felicidade", videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//metafora_da_felicidade.mp4" },
    { id: 7, title: "A Metáfora da Raiva", videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//a_metafora_da_raiva.mp4" },
    { id: 8, title: "Lidando com as Emoções", videoUrl: "https://kcpdeeudnonqrjsppxwz.supabase.co/storage/v1/object/public/videos//lidando_com_as_emocoes.mp4" },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Instruções</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.instructionsGrid}>
          {instructionVideos.map((item) => (
            <View key={item.id} style={styles.instructionCard}>
              <View style={styles.thumbnailContainer}>
                <VideoScreen videoUrl={item.videoUrl} />
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const { width } = Dimensions.get("window")
const cardWidth = width > 500 ? width / 2 - 24 : width - 32

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  closeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#10B981",
    borderRadius: 8,
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  instructionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: width > 500 ? "space-between" : "center",
  },
  instructionCard: {
    width: cardWidth,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
    overflow: "hidden",
  },
  thumbnailContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#E5E7EB",
    position: "relative",
    overflow: "visible",
  },
  thumbnailPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#10B981",
  },
  thumbnailText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6B7280",
  },
})

export default InstructionsScreen
