import { useEffect } from 'react';
import { supabase } from '../services/supabase';
import { pointsHistoryService } from '../services/pointsHistoryService';

/**
 * Hook para escutar mudanças nas tabelas que afetam o histórico de pontos
 */
export const usePointsHistorySubscription = (userId?: string) => {
  useEffect(() => {
    if (!userId) return;
    
    // Função para registrar pontos quando uma entrada de diário é criada
    const handleDiaryEntry = async (payload: any) => {
      const entry = payload.new;
      await pointsHistoryService.recordPointsActivity(
        userId,
        'diary_entry',
        'Novo registro no diário emocional',
        5 // Pontos por registro no diário
      );
    };
    
    // Função para registrar pontos quando um desafio é completado
    const handleCompletedChallenge = async (payload: any) => {
      const challenge = payload.new;
      let activityType: 'daily_challenge' | 'weekly_challenge' | 'family_challenge';
      let description = 'Desafio completado';
      let points = 10; // Valor padrão
      
      // Determinar tipo de desafio e pontos com base nos dados
      if (challenge.challenge_type === 'daily') {
        activityType = 'daily_challenge';
        description = 'Desafio diário completado';
        points = 10;
      } else if (challenge.challenge_type === 'weekly') {
        activityType = 'weekly_challenge';
        description = 'Desafio semanal completado';
        points = 20;
      } else {
        activityType = 'family_challenge';
        description = 'Desafio familiar completado';
        points = 30;
      }
      
      await pointsHistoryService.recordPointsActivity(
        userId,
        activityType,
        description,
        points
      );
    };
    
    // Função para registrar pontos quando uma meta é completada
    const handleCompletedGoal = async (payload: any) => {
      const goal = payload.new;
      if (goal.completed) {
        await pointsHistoryService.recordPointsActivity(
          userId,
          'goal_completed',
          'Meta semanal completada',
          15 // Pontos por meta completada
        );
      }
    };
    
    // Função para registrar pontos quando uma história é lida
    const handleStoryRead = async (payload: any) => {
      const story = payload.new;
      await pointsHistoryService.recordPointsActivity(
        userId,
        'story_reading',
        'História lida',
        5 // Pontos por história lida
      );
    };
    
    // Configurar subscriptions para cada tabela
    const emotionEntriesSubscription = supabase
      .channel('emotion_entries_changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'emotion_entries',
          filter: `user_id=eq.${userId}`
        }, 
        handleDiaryEntry
      )
      .subscribe();
      
    // const challengesSubscription = supabase
    //   .channel('completed_challenges_changes')
    //   .on('postgres_changes', 
    //     { 
    //       event: 'INSERT', 
    //       schema: 'public', 
    //       table: 'completed_challenges',
    //       filter: `user_id=eq.${userId}`
    //     }, 
    //     handleCompletedChallenge
    //   )
    //   .subscribe();
      
    const goalsSubscription = supabase
      .channel('weekly_goals_changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'weekly_goals',
          filter: `user_id=eq.${userId}`
        }, 
        handleCompletedGoal
      )
      .subscribe();
      
    const storiesSubscription = supabase
      .channel('user_stories_changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'user_stories',
          filter: `user_id=eq.${userId}`
        }, 
        handleStoryRead
      )
      .subscribe();
      
    // Limpar subscriptions ao desmontar
    return () => {
      supabase.removeChannel(emotionEntriesSubscription);
      //supabase.removeChannel(challengesSubscription);
      supabase.removeChannel(goalsSubscription);
      supabase.removeChannel(storiesSubscription);
    };
  }, [userId]);
};