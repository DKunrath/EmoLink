import { supabase } from './supabase';
import { pointsHistoryService } from './pointsHistoryService';

type ActivityType = 'daily_challenge' | 'weekly_challenge' | 'family_challenge' | 'diary_entry' | 'story_reading' | 'goal_completed';

/**
 * Atualiza os pontos do usuário e registra no histórico
 */
export const updateUserPoints = async (
  userId: string, 
  points: number, 
  activityType?: ActivityType, 
  description?: string
) => {
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

    // 4. Registrar no histórico de pontos (se fornecido tipo e descrição)
    if (activityType && description && points > 0) {
      await pointsHistoryService.recordPointsActivity(
        userId,
        activityType,
        description,
        points
      );
    }

    return newPoints;
  } catch (error) {
    return null;
  }
};