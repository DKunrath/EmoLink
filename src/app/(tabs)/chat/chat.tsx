import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, 
  TouchableOpacity, FlatList, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated,
  SafeAreaView
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../../../services/supabase';

type ChatRouteProp = RouteProp<{ params: { chatId: string } }, 'params'>;

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at?: string;
}

const Chat = () => {
  const route = useRoute<ChatRouteProp>();
  const { chatId } = route.params;
  const flatListRef = useRef<FlatList>(null);

  const DOCTOR_ID = 'b46ab255-8937-4904-9ba1-3d533027b0d9'; // ID da doutora

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Animation value
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    fetchMessages();
    fetchUserId();

    const channel = supabase
      .channel(`messages:chat_id=eq.${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          
          // Scroll to bottom when new message arrives
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
      } else {
        setMessages(data || []);
        
        // Animate content in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
        
        // Scroll to bottom after messages load
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const fetchUserId = async () => {
    try {
      const { data: user, error } = await supabase.auth.getUser();
      if (error) {
      } else {
        setUserId(user?.user?.id || null);
      }
    } catch (error) {
    }
  };

  const sendMessage = async () => {
    if (newMessage.trim() && userId) {
      setSending(true);
      try {
        const { error } = await supabase.from('messages').insert([
          { 
            chat_id: chatId, 
            sender_id: userId, 
            content: newMessage,
            created_at: new Date().toISOString()
          }
        ]);

        if (error) {
        } else {
          setNewMessage('');
          await updateLastMessage(newMessage);
          await updateUnreadCount();
        }
      } catch (error) {
      } finally {
        setSending(false);
      }
    }
  };

  const updateLastMessage = async (message: string) => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ last_message: message, updated_at: new Date().toISOString() })
        .eq('id', chatId);

      if (error) {
      }
    } catch (error) {
    }
  };

  const updateUnreadCount = async () => {
    try {
      const columnToUpdate = userId === DOCTOR_ID ? 'unread_count_doctor' : 'unread_count_patient';
  
      // Busque o valor atual do campo
      const { data, error: fetchError } = await supabase
        .from('chats')
        .select(columnToUpdate)
        .eq('id', chatId)
        .single();
  
      if (fetchError) {
        return;
      }
  
      const currentCount = data && (data as any)[columnToUpdate] !== undefined ? (data as any)[columnToUpdate] : 0;
  
      // Incrementa o valor
      const newCount = currentCount + 1;
  
      // Atualize o valor no banco de dados
      const { error: updateError } = await supabase
        .from('chats')
        .update({ [columnToUpdate]: newCount })
        .eq('id', chatId);
  
      if (updateError) {
        return;
      }
    } catch (error) {
      return;
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isDoctor = item.sender_id === DOCTOR_ID;
    
    return (
      <View style={[
        styles.messageContainer,
        isDoctor ? styles.doctorMessage : styles.patientMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isDoctor ? styles.doctorBubble : styles.patientBubble
        ]}>
          <Text style={[
            styles.messageText,
            isDoctor ? styles.doctorText : styles.patientText
          ]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.senderName}>
          {isDoctor ? 'Dra. Ana' : 'Você'}
        </Text>
      </View>
    );
  };

  const renderEmptyComponent = () => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Nenhuma mensagem ainda</Text>
        <Text style={styles.emptySubtext}>Envie uma mensagem para iniciar a conversa</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
        keyboardVerticalOffset={100}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {userId === DOCTOR_ID ? 'Chat com Paciente' : 'Chat com Dra. Ana'}
          </Text>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F163E0" />
            <Text style={styles.loadingText}>Carregando mensagens...</Text>
          </View>
        ) : (
          <Animated.View style={[styles.chatContainer, { opacity: fadeAnim }]}>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesList}
              ListEmptyComponent={renderEmptyComponent}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        )}
        
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Digite sua mensagem..."
            placeholderTextColor="#9CA3AF"
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || sending) && styles.sendButtonDisabled
            ]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending || !userId}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Enviar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#F163E0',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  doctorMessage: {
    alignSelf: 'flex-start',
  },
  patientMessage: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 4,
  },
  doctorBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  patientBubble: {
    backgroundColor: '#6366F1',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  doctorText: {
    color: '#111827',
  },
  patientText: {
    color: '#FFFFFF',
  },
  senderName: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    marginRight: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#6366F1',
    borderRadius: 20,
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#A5B4FC',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default Chat;