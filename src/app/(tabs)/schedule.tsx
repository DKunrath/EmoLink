"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native"
import { router } from "expo-router"
import { useAuth } from "../../hooks/useAuth"
import { appointmentService } from "../../services/appointments"
import type { TimeSlot } from "../../types/appointments"
import { supabase } from "../../services/supabase"

interface CalendarDay {
  date: string
  day: number
  isCurrentMonth: boolean
  isToday: boolean
  hasAvailableSlots: boolean
  isPast: boolean
}

export default function ScheduleAppointmentScreen() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [booking, setBooking] = useState(false)
  const [doctorId, setDoctorId] = useState<string>("")
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  useEffect(() => {
    findDoctorAndInitialize()
  }, [])

  useEffect(() => {
    if (doctorId) {
      generateCalendar()
    }
  }, [currentMonth, doctorId])

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots()
    }
  }, [selectedDate])

  const findDoctorAndInitialize = async () => {
    try {
      setLoading(true)
      // ID fixo da doutora
      setDoctorId("b46ab255-8937-4904-9ba1-3d533027b0d9")
      console.log("Using fixed doctor ID: b46ab255-8937-4904-9ba1-3d533027b0d9")
    } catch (error) {
      console.error("Error initializing:", error)
      Alert.alert("Erro", "Erro ao inicializar o sistema")
    } finally {
      setLoading(false)
    }
  }

  const generateCalendar = async () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Primeiro dia do mês
    const firstDay = new Date(year, month, 1)

    // Primeiro dia da semana (domingo = 0)
    const startDate = new Date(firstDay)
    startDate.setDate(startDate.getDate() - firstDay.getDay())

    const days: CalendarDay[] = []

    // Buscar disponibilidade do médico
    let doctorAvailability: any[] = []
    if (doctorId) {
      try {
        const { data, error } = await supabase
          .from("doctor_availability")
          .select("day_of_week, start_time, end_time")
          .eq("doctor_id", doctorId)
          .eq("is_active", true)

        if (!error && data) {
          doctorAvailability = data
          console.log("Doctor availability found:", data)
        } else {
          console.error("Error or no data:", error)
        }
      } catch (error) {
        console.error("Error fetching doctor availability:", error)
      }
    }

    // Gerar 42 dias (6 semanas)
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)

      // Usar formatação local para evitar problemas de timezone
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const day = String(date.getDate()).padStart(2, "0")
      const dateString = `${year}-${month}-${day}`

      const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
      const isToday = date.getTime() === today.getTime()
      const isPast = date < today

      // Verificar se o médico tem disponibilidade neste dia da semana
      const dayOfWeek = date.getDay()
      const hasAvailability = doctorAvailability.some((avail) => avail.day_of_week === dayOfWeek)

      days.push({
        date: dateString,
        day: date.getDate(),
        isCurrentMonth,
        isToday,
        hasAvailableSlots: isCurrentMonth && !isPast && hasAvailability,
        isPast,
      })
    }

    setCalendarDays(days)
  }

  const loadAvailableSlots = async () => {
    try {
      setLoadingSlots(true)
      setAvailableSlots([])

      if (!doctorId) {
        Alert.alert("Erro", "Médico não encontrado")
        return
      }

      console.log("Loading slots for:", selectedDate, "Doctor:", doctorId)

      const slots = await appointmentService.getAvailableSlots(doctorId, selectedDate)
      console.log("Available slots:", slots)

      setAvailableSlots(slots)
    } catch (error) {
      console.error("Error loading slots:", error)
      Alert.alert("Erro", "Não foi possível carregar os horários disponíveis")
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleDatePress = (day: CalendarDay) => {
    if (!day.hasAvailableSlots || day.isPast) return

    setSelectedDate(day.date)
    setSelectedTime("")
    setNotes("")
  }

  const handleTimeSlotPress = (time: string) => {
    setSelectedTime(time)
  }

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert("Erro", "Por favor, selecione uma data e horário")
      return
    }

    if (!user) {
      Alert.alert("Erro", "Usuário não encontrado")
      return
    }

    if (!doctorId) {
      Alert.alert("Erro", "Médico não encontrado")
      return
    }

    try {
      setBooking(true)

      console.log("Booking appointment:", {
        patientId: user.id,
        doctorId,
        date: selectedDate,
        time: selectedTime,
        notes,
      })

      await appointmentService.createAppointment(user.id, doctorId, selectedDate, selectedTime, notes || undefined)

      Alert.alert("Sucesso", "Consulta agendada com sucesso!", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ])
    } catch (error) {
      console.error("Error booking appointment:", error)
      Alert.alert("Erro", "Não foi possível agendar a consulta. Tente novamente.")
    } finally {
      setBooking(false)
    }
  }

  const navigateMonth = (direction: number) => {
    const newMonth = new Date(currentMonth)
    newMonth.setMonth(currentMonth.getMonth() + direction)
    setCurrentMonth(newMonth)
    setSelectedDate("")
    setSelectedTime("")
  }

  const formatMonthYear = () => {
    return currentMonth.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    })
  }

  const formatSelectedDate = () => {
    if (!selectedDate) return ""

    // Criar a data usando os componentes separados para evitar problemas de timezone
    const [year, month, day] = selectedDate.split("-").map(Number)
    const date = new Date(year, month - 1, day) // month - 1 porque Date usa 0-11 para meses

    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F163E0" />
          <Text style={styles.loadingText}>Carregando calendário...</Text>
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
        <Text style={styles.title}>Agendar Consulta</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Calendar Header */}
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.monthButton}>
              <Text style={styles.monthButtonText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{formatMonthYear()}</Text>
            <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.monthButton}>
              <Text style={styles.monthButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Week Days */}
          <View style={styles.weekDaysContainer}>
            {weekDays.map((day) => (
              <View key={day} style={styles.weekDayItem}>
                <Text style={styles.weekDayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Days */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.calendarDay,
                  !day.isCurrentMonth && styles.calendarDayInactive,
                  day.isToday && styles.calendarDayToday,
                  selectedDate === day.date && styles.calendarDaySelected,
                  day.isPast && styles.calendarDayPast,
                  !day.hasAvailableSlots && styles.calendarDayUnavailable,
                ]}
                onPress={() => handleDatePress(day)}
                disabled={!day.hasAvailableSlots || day.isPast}
              >
                <Text
                  style={[
                    styles.calendarDayText,
                    !day.isCurrentMonth && styles.calendarDayTextInactive,
                    day.isToday && styles.calendarDayTextToday,
                    selectedDate === day.date && styles.calendarDayTextSelected,
                    day.isPast && styles.calendarDayTextPast,
                  ]}
                >
                  {day.day}
                </Text>
                {day.hasAvailableSlots && !day.isPast && <View style={styles.availableDot} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Available Time Slots */}
        {selectedDate && (
          <View style={styles.slotsContainer}>
            <Text style={styles.slotsTitle}>Horários disponíveis para {formatSelectedDate()}</Text>

            {loadingSlots ? (
              <View style={styles.slotsLoading}>
                <ActivityIndicator size="small" color="#F163E0" />
                <Text style={styles.slotsLoadingText}>Carregando horários...</Text>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {availableSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot.time}
                    style={[
                      styles.timeSlot,
                      !slot.available && styles.timeSlotUnavailable,
                      selectedTime === slot.time && styles.timeSlotSelected,
                    ]}
                    onPress={() => slot.available && handleTimeSlotPress(slot.time)}
                    disabled={!slot.available}
                  >
                    <Text
                      style={[
                        styles.timeSlotText,
                        !slot.available && styles.timeSlotTextUnavailable,
                        selectedTime === slot.time && styles.timeSlotTextSelected,
                      ]}
                    >
                      {slot.time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Booking Form */}
        {selectedDate && selectedTime && (
          <View style={styles.bookingContainer}>
            <Text style={styles.bookingTitle}>Confirmar Agendamento</Text>
            <Text style={styles.bookingDate}>
              {formatSelectedDate()} às {selectedTime}
            </Text>

            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Observações (opcional)</Text>
              <TextInput
                style={styles.notesInput}
                multiline
                numberOfLines={3}
                placeholder="Descreva brevemente o motivo da consulta..."
                value={notes}
                onChangeText={setNotes}
                maxLength={500}
              />
            </View>

            <TouchableOpacity
              style={[styles.bookButton, booking && styles.bookButtonDisabled]}
              onPress={handleBookAppointment}
              disabled={booking}
            >
              {booking ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.bookButtonText}>Confirmar Agendamento</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
  calendarContainer: {
    backgroundColor: "#FFFFFF",
    margin: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  monthButtonText: {
    fontSize: 20,
    color: "#374151",
    fontWeight: "600",
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    textTransform: "capitalize",
  },
  weekDaysContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDayItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDay: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  calendarDayInactive: {
    opacity: 0.3,
  },
  calendarDayToday: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  calendarDaySelected: {
    backgroundColor: "#F163E0",
    borderRadius: 8,
  },
  calendarDayPast: {
    opacity: 0.3,
  },
  calendarDayUnavailable: {
    opacity: 0.5,
  },
  calendarDayText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  calendarDayTextInactive: {
    color: "#9CA3AF",
  },
  calendarDayTextToday: {
    color: "#D97706",
    fontWeight: "bold",
  },
  calendarDayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  calendarDayTextPast: {
    color: "#9CA3AF",
  },
  availableDot: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10B981",
  },
  slotsContainer: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  slotsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
    textTransform: "capitalize",
  },
  slotsLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  slotsLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#6B7280",
  },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeSlot: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    minWidth: 70,
    alignItems: "center",
  },
  timeSlotUnavailable: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },
  timeSlotSelected: {
    backgroundColor: "#F163E0",
    borderColor: "#F163E0",
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  timeSlotTextUnavailable: {
    color: "#9CA3AF",
  },
  timeSlotTextSelected: {
    color: "#FFFFFF",
  },
  bookingContainer: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  bookingTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
  },
  bookingDate: {
    fontSize: 16,
    color: "#F163E0",
    fontWeight: "600",
    marginBottom: 20,
    textTransform: "capitalize",
  },
  notesContainer: {
    marginBottom: 20,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#374151",
    backgroundColor: "#FFFFFF",
    textAlignVertical: "top",
    minHeight: 80,
  },
  bookButton: {
    backgroundColor: "#F163E0",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bookButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  bookButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
})
