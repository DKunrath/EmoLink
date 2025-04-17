import { supabase } from "./supabase";

export interface EmotionEntry {
  id: string;
  user_id: string;
  emotion_type: string;
  emotion_description: string;
  intensity: number;
  created_at: string;
  updated_at: string;
}

export const diaryService = {
  async createEntry(
    entry: Omit<EmotionEntry, "id" | "created_at" | "updated_at">
  ) {
    console.log("Creating entry:", entry);

    if (!entry.user_id) {
      throw new Error("user_id is required");
    }

    try {
      const { data, error } = await supabase
        .from("emotion_entries")
        .insert([
          {
            ...entry,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Entry created:", data);
      return data;
    } catch (error) {
      console.error("Create entry error:", error);
      throw error;
    }
  },

  async getUserEntries(userId: string, page: number = 1, limit: number = 10) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from("emotion_entries")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return {
      entries: data as EmotionEntry[],
      total: count || 0,
      hasMore: (count || 0) > page * limit,
    };
  },

  async getEntry(id: string) {
    const { data, error } = await supabase
      .from("emotion_entries")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as EmotionEntry;
  },

  async updateEntry(id: string, updates: Partial<EmotionEntry>) {
    const { data, error } = await supabase
      .from("emotion_entries")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteEntry(id: string) {
    const { error } = await supabase
      .from("emotion_entries")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

// Função para atualizar os pontos do usuário após criar uma entrada no diário
export const updateUserPoints = async (userId: string, points: number) => {
  try {
    // 1. Buscar a pontuação atual do usuário
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("points")
      .eq("user_id", userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    // 2. Calcular a nova pontuação
    const currentPoints = profileData.points || 0;
    const newPoints = currentPoints + points;

    // 3. Atualizar a pontuação na tabela profiles
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ points: newPoints })
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    return newPoints;
  } catch (error) {
    console.error("Erro ao atualizar pontos do usuário:", error);
    return null;
  }
};

export const updateParentPoints = async (userId: string, parent_points: number) => {
  try {
    // 1. Buscar a pontuação atual do usuário
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("parent_points")
      .eq("user_id", userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    // 2. Calcular a nova pontuação
    const currentParentPoints = profileData.parent_points || 0;
    const newParentPoints = currentParentPoints + parent_points;

    // 3. Atualizar a pontuação na tabela profiles
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ parent_points: newParentPoints })
      .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    return newParentPoints;
  } catch (error) {
    console.error("Erro ao atualizar pontos do usuário:", error);
    return null;
  }
};