"use client"

import { useState, useEffect, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from "react-native"
import { router, useFocusEffect } from "expo-router"
import { useAuth } from "../../hooks/useAuth"
import { appointmentService } from "../../services/appointments"
import type { Appointment } from "../../types/appointments"
import { LinearGradient } from "expo-linear-gradient"

export default function AppointmentsScreen() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [isDoctor, setIsDoctor] = useState(false)

  // Recarregar dados sempre que a tela ganhar foco
  useFocusEffect(
    useCallback(() => {
      console.log("Screen focused, reloading appointments...")
      if (user) {
        loadAppointments()
        checkIfDoctor()
      }
    }, [user]),
  )

  useEffect(() => {
    if (user) {
      loadAppointments()
      checkIfDoctor()
    }
  }, [user])

  const checkIfDoctor = async () => {
    setIsDoctor(user?.id === "b46ab255-8937-4904-9ba1-3d533027b0d9" || false)
  }

  const loadAppointments = async () => {
    try {
      setLoading(true)
      if (user) {
        const data = await appointmentService.getUserAppointments(user.id)
        console.log("Loaded appointments:", data.length)
        setAppointments(data)
      }
    } catch (error) {
      console.error("Error loading appointments:", error)
      Alert.alert("Erro", "Não foi possível carregar os agendamentos")
    } finally {
      setLoading(false)
    }
  }

  const handleCancelAppointment = useCallback((appointmentId: string) => {
    console.log("Cancel button pressed for appointment:", appointmentId)

    // Usar setTimeout para garantir que o Alert seja executado
    setTimeout(() => {
      try {
        Alert.alert(
          "Cancelar Consulta",
          "Tem certeza que deseja cancelar esta consulta? Esta ação não pode ser desfeita.",
          [
            {
              text: "Não",
              style: "cancel",
              onPress: () => {
                console.log("Cancel pressed")
              },
            },
            {
              text: "Sim, Cancelar",
              style: "destructive",
              onPress: async () => {
                console.log("Confirm pressed - starting cancellation")
                try {
                  console.log("Calling appointmentService.cancelAppointment...")
                  await appointmentService.cancelAppointment(appointmentId, "Cancelado pelo paciente")
                  console.log("Appointment cancelled successfully")

                  // Recarregar a lista
                  await loadAppointments()

                  Alert.alert("Sucesso", "Consulta cancelada com sucesso")
                } catch (error) {
                  console.error("Error cancelling appointment:", error)
                  Alert.alert("Erro", "Não foi possível cancelar a consulta. Tente novamente.")
                }
              },
            },
          ],
          { cancelable: false },
        )
      } catch (error) {
        console.error("Error showing alert:", error)
        // Fallback: cancelar diretamente se o Alert falhar
        cancelAppointmentDirectly(appointmentId)
      }
    }, 100)
  }, [])

  const cancelAppointmentDirectly = async (appointmentId: string) => {
    try {
      console.log("Cancelling appointment directly...")
      await appointmentService.cancelAppointment(appointmentId, "Cancelado pelo paciente")
      await loadAppointments()
      Alert.alert("Sucesso", "Consulta cancelada com sucesso")
    } catch (error) {
      console.error("Error in direct cancellation:", error)
      Alert.alert("Erro", "Não foi possível cancelar a consulta")
    }
  }

  const formatDate = (dateString: string) => {
    // Criar a data usando os componentes separados para evitar problemas de timezone
    const [year, month, day] = dateString.split("-").map(Number)
    const date = new Date(year, month - 1, day) // month - 1 porque Date usa 0-11 para meses

    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "#10B981"
      case "cancelled":
        return "#EF4444"
      case "completed":
        return "#6B7280"
      default:
        return "#6B7280"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "scheduled":
        return "Agendada"
      case "cancelled":
        return "Cancelada"
      case "completed":
        return "Concluída"
      default:
        return status
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F163E0" />
          <Text style={styles.loadingText}>Carregando agendamentos...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Agendamentos</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/schedule")}>
            <LinearGradient
              colors={["#F163E0", "#D14EC4"]}
              style={styles.actionButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.actionButtonIcon}>📅</Text>
              <Text style={styles.actionButtonText}>Agendar Consulta</Text>
            </LinearGradient>
          </TouchableOpacity>

          {isDoctor && (
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/appointments/manage")}>
              <LinearGradient
                colors={["#8B5CF6", "#7C3AED"]}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.actionButtonIcon}>⚙️</Text>
                <Text style={styles.actionButtonText}>Gerenciar Agenda</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* Debug Info */}
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>
            Total de consultas: {appointments.length} | Usuário: {user?.id?.slice(0, 8)}...
          </Text>
        </View>

        {/* Appointments List */}
        <View style={styles.appointmentsContainer}>
          <Text style={styles.sectionTitle}>Suas Consultas</Text>

          {appointments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>Nenhuma consulta agendada</Text>
              <Text style={styles.emptyDescription}>
                Clique em "Agendar Consulta" para marcar sua primeira consulta com a Doutora.
              </Text>
            </View>
          ) : (
            appointments.map((appointment) => (
              <View key={appointment.id} style={styles.appointmentCard}>
                <View style={styles.appointmentHeader}>
                  <View style={styles.appointmentInfo}>
                    <Text style={styles.appointmentDate}>{formatDate(appointment.appointment_date)}</Text>
                    <Text style={styles.appointmentTime}>{formatTime(appointment.appointment_time)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(appointment.status)}</Text>
                  </View>
                </View>

                {appointment.notes && <Text style={styles.appointmentNotes}>Observações: {appointment.notes}</Text>}

                {appointment.cancellation_reason && (
                  <Text style={styles.cancellationReason}>
                    Motivo do cancelamento: {appointment.cancellation_reason}
                  </Text>
                )}

                {appointment.status === "scheduled" && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => cancelAppointmentDirectly(appointment.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar Consulta</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: "#F163E0",
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  actionButtonsContainer: {
    padding: 20,
    gap: 12,
  },
  actionButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  actionButtonIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  debugContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  appointmentsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  appointmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  appointmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentDate: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  appointmentTime: {
    fontSize: 14,
    color: "#6B7280",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  appointmentNotes: {
    fontSize: 14,
    color: "#4B5563",
    marginTop: 8,
    fontStyle: "italic",
  },
  cancellationReason: {
    fontSize: 14,
    color: "#EF4444",
    marginTop: 8,
    fontStyle: "italic",
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  cancelButtonText: {
    fontSize: 14,
    color: "#DC2626",
    fontWeight: "600",
  },
})
