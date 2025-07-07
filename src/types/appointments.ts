export interface Appointment {
  id: string
  patient_id: string
  doctor_id: string
  appointment_date: string
  appointment_time: string
  status: "scheduled" | "cancelled" | "completed"
  cancellation_reason?: string
  notes?: string
  created_at: string
  updated_at: string
  patient_name?: string
  doctor_name?: string
}

export interface DoctorAvailability {
  id: string
  doctor_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
}

export interface TimeSlot {
  time: string
  available: boolean
  appointmentId?: string
}

export interface DaySchedule {
  date: string
  dayName: string
  timeSlots: TimeSlot[]
}
