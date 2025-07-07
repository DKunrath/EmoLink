import { supabase } from "./supabase"
import type { Appointment, DoctorAvailability, TimeSlot, DaySchedule } from "../types/appointments"

export const appointmentService = {
  // Get user's appointments
  async getUserAppointments(userId: string): Promise<Appointment[]> {
    const { data, error } = await supabase
      .from("appointments")
      .select('*')
      .eq('patient_id', userId)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false })

    if (error) throw error

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select('full_name')
      .eq('user_id', userId)
      .limit(1)

    if (profileError) throw profileError

    return (
      data?.map((appointment) => ({
        ...appointment,
        patient_name: profileData[0]?.full_name,
        doctor_name: 'Dra Ana Claudia Cavalcanti',
      })) || []
    )
  },

  // Get doctor availability
  async getDoctorAvailability(doctorId: string): Promise<DoctorAvailability[]> {
    const { data, error } = await supabase
      .from("doctor_availability")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("is_active", true)
      .order("day_of_week")
      .order("start_time")

    if (error) throw error
    return data || []
  },

  // Generate available time slots for a specific date
  async getAvailableSlots(doctorId: string, date: string): Promise<TimeSlot[]> {
    console.log("Getting available slots for:", { doctorId, date })

    const dayOfWeek = new Date(date + "T00:00:00").getDay()
    console.log("Day of week calculated:", dayOfWeek, "for date:", date)

    // Get doctor availability for this day
    const { data: availability, error: availError } = await supabase
      .from("doctor_availability")
      .select("*")
      .eq("doctor_id", doctorId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)

    console.log("Doctor availability query result:", availability)
    console.log("Searching for day_of_week =", dayOfWeek)

    if (availError) {
      console.error("Availability error:", availError)
      throw availError
    }

    if (!availability || availability.length === 0) {
      console.log("No availability found for this day")
      return []
    }

    // Get existing appointments for this specific date
    const { data: appointments, error: apptError } = await supabase
      .from("appointments")
      .select("appointment_time, id, status")
      .eq("doctor_id", doctorId)
      .eq("appointment_date", date)
      .eq("status", "scheduled")

    console.log("Existing appointments for this date:", appointments)

    if (apptError) {
      console.error("Appointments error:", apptError)
      throw apptError
    }

    const bookedTimes = new Set(appointments?.map((apt) => apt.appointment_time) || [])
    console.log("Booked times:", Array.from(bookedTimes))

    const timeSlots: TimeSlot[] = []

    // Generate time slots based on availability
    availability.forEach((avail) => {
      const startTime = new Date(`2000-01-01T${avail.start_time}`)
      const endTime = new Date(`2000-01-01T${avail.end_time}`)

      const current = new Date(startTime)
      while (current < endTime) {
        const timeString = current.toTimeString().slice(0, 5)
        const timeWithSeconds = timeString + ":00"
        const isBooked = bookedTimes.has(timeWithSeconds)

        console.log(`Time slot ${timeString}: ${isBooked ? "BOOKED" : "AVAILABLE"}`)

        timeSlots.push({
          time: timeString,
          available: !isBooked,
          appointmentId: appointments?.find((apt) => apt.appointment_time === timeWithSeconds)?.id,
        })

        current.setHours(current.getHours() + 1)
      }
    })

    console.log("Final time slots:", timeSlots)
    return timeSlots
  },

  // Create new appointment
  async createAppointment(
    patientId: string,
    doctorId: string,
    date: string,
    time: string,
    notes?: string,
  ): Promise<Appointment> {
    const { data, error } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        appointment_date: date,
        appointment_time: time + ":00",
        notes,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Delete appointment (instead of just canceling)
  async cancelAppointment(appointmentId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId)

    if (error) throw error
  },

  // Complete appointment
  async completeAppointment(appointmentId: string, notes?: string): Promise<void> {
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "completed",
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", appointmentId)

    if (error) throw error
  },

  // Generate schedule for next 60 days
  async generateSchedule(doctorId: string): Promise<DaySchedule[]> {
    const schedule: DaySchedule[] = []
    const today = new Date()

    for (let i = 0; i < 60; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)

      const dateString = date.toISOString().split("T")[0]
      const dayName = date.toLocaleDateString("pt-BR", { weekday: "long" })

      const timeSlots = await this.getAvailableSlots(doctorId, dateString)

      schedule.push({
        date: dateString,
        dayName,
        timeSlots,
      })
    }

    return schedule
  },
}
