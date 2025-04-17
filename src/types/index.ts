export type UserRole = 'parent_child' | 'doctor';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface EmotionEntry {
  id: string;
  user_id: string;
  emotion_type: string;
  emotion_description: string;
  intensity: number;
  created_at: string;
  updated_at: string;
} 