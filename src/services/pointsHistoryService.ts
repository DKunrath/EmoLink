import { supabase } from './supabase';

type ActivityType = 'daily_challenge' | 'weekly_challenge' | 'family_challenge' | 'diary_entry' | 'story_reading' | 'goal_completed';

export const pointsHistoryService = {
  /**
   * Registra uma nova entrada no histórico de pontos
   */
  async recordPointsActivity(
    userId: string, 
    activityType: ActivityType, 
    description: string, 
    points: number
  ) {
    try {
      // Não registrar atividades com 0 pontos
      if (points === 0) return { success: true };
      
      const { data, error } = await supabase
        .from('points_history')
        .insert({
          user_id: userId,
          activity_type: activityType,
          description,
          points
        })
        .select()
        .single();
        
      if (error) throw error;
      
      return { success: true, data };
    } catch (error) {
      return { success: false, error };
    }
  },
  
  /**
   * Obtém o histórico de pontos de um usuário com paginação
   */
  async getUserPointsHistory(userId: string, page = 0, itemsPerPage = 10) {
    try {
      // Obter contagem total
      const { count, error: countError } = await supabase
        .from('points_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (countError) throw countError;
      
      // Obter itens paginados
      const { data, error } = await supabase
        .from('points_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(page * itemsPerPage, (page + 1) * itemsPerPage - 1);
        
      if (error) throw error;
      
      return { 
        data, 
        totalCount: count || 0,
        hasMore: (data?.length || 0) === itemsPerPage
      };
    } catch (error) {
      return { data: [], totalCount: 0, hasMore: false, error };
    }
  }
};