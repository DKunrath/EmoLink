import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

// Tipos para o histórico de pontos
export type PointsHistoryItem = {
  id: string;
  user_id: string;
  activity_type: 'daily_challenge' | 'weekly_challenge' | 'family_challenge' | 'diary_entry' | 'story_reading' | 'goal_completed';
  description: string;
  points: number;
  created_at: string;
};

// Mapeamento de tipos de atividade para texto legível
const activityTypeLabels = {
  daily_challenge: 'Desafio Diário',
  weekly_challenge: 'Desafio Semanal',
  family_challenge: 'Desafio Familiar',
  diary_entry: 'Registro no Diário',
  story_reading: 'Leitura de História',
  goal_completed: 'Meta Completada',
};

const ITEMS_PER_PAGE = 10;

export const PointsHistorySection = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<PointsHistoryItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  const ITEMS_PER_PAGE = 10;

  // Função para carregar o histórico de pontos
  const loadPointsHistory = async (pageNumber = 0) => {
    if (!user) return;

    try {
      setLoading(true);

      // Obter a contagem total para paginação (apenas na primeira página)
      if (pageNumber === 0) {
        const { count, error: countError } = await supabase
          .from('points_history')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (countError) throw countError;
        setTotalItems(count || 0);
      }

      // Buscar os itens paginados
      const { data, error } = await supabase
        .from('points_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(pageNumber * ITEMS_PER_PAGE, (pageNumber + 1) * ITEMS_PER_PAGE - 1);

      if (error) throw error;

      // Atualizar o histórico com os itens carregados
      setHistory(data || []);

      // Verificar se há mais itens para carregar
      setHasMore((data?.length || 0) === ITEMS_PER_PAGE);
    } catch (error) {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  // Carregar histórico inicial
  useEffect(() => {
    if (user) {
      loadPointsHistory(page);
    }
  }, [user, page]);

  // Renderizar item do histórico
  const renderHistoryItem = ({ item }: { item: PointsHistoryItem }) => {
    if (item.points === 0) return null;

    return (
      <View style={styles.historyItem}>
        <View style={styles.historyItemContent}>
          <Text style={styles.activityType}>
            {activityTypeLabels[item.activity_type] || item.activity_type}
          </Text>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString('pt-BR')}
          </Text>
        </View>
        <View style={styles.pointsContainer}>
          <Text style={styles.points}>+{item.points}</Text>
        </View>
      </View>
    );
  };

  // Renderizar footer com botões de navegação
  const renderFooter = () => {
    return (
      <View style={styles.paginationContainer}>
        <TouchableOpacity
          style={[styles.paginationButton, page === 0 && styles.disabledButton]}
          onPress={() => setPage((prev) => Math.max(prev - 1, 0))}
          disabled={page === 0}
        >
          <Text style={styles.paginationButtonText}>Página Anterior</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.paginationButton, !hasMore && styles.disabledButton]}
          onPress={() => setPage((prev) => prev + 1)}
          disabled={!hasMore}
        >
          <Text style={styles.paginationButtonText}>Próxima Página</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico de Pontos</Text>
        <Text style={styles.subtitle}>
          {totalItems} {totalItems === 1 ? 'atividade' : 'atividades'} registrada{totalItems !== 1 ? 's' : ''}
        </Text>
      </View>

      {loading && history.length === 0 ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      ) : history.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Nenhuma atividade registrada ainda</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={renderFooter}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  list: {
    paddingBottom: 20,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  historyItemContent: {
    flex: 1,
  },
  activityType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  pointsContainer: {
    backgroundColor: '#FDE8F3', // Fundo rosa claro
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 12,
  },
  points: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F163E0', // Rosa principal
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  paginationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F163E0', // Rosa principal
    borderRadius: 20,
    alignItems: 'center',
  },
  paginationButtonText: {
    color: '#FFFFFF', // Texto branco
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: '#F8BBF0', // Rosa claro para botões desativados
  },
  loader: {
    marginVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
});