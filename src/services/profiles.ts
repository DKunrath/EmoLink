import { supabase } from './supabase'; // Substitua pelo módulo de conexão com o banco de dados

export const profilesService = {
  async getProfile(userId: string) {
    try {
      // Substitua pela lógica de consulta ao banco de dados
      const { data, error } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', userId);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        return data[0]; // Retorna o primeiro resultado
      }

      // Removed redundant block referencing 'result'

      return null; // Retorna null se o perfil não for encontrado
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      throw error;
    }
  },
};
