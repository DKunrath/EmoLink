import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { biometricAuthService } from '../services/biometricAuth';
import { secureStorageService } from '../services/secureStorage';
import { authService } from '../services/auth';
import { useAlertContext } from "../components/alert-provider"
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SettingsScreenProps {
  onClose?: () => void
}

const SettingsScreen: React.FC<SettingsScreenProps> = () => {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [showProfileInShared, setShowProfileInShared] = useState(true);
  const [profilePrivacyLoading, setProfilePrivacyLoading] = useState(false);
  const { success, error2 } = useAlertContext();
  const { user } = useAuth();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);

      // Check if biometric is available
      const isAvailable = await biometricAuthService.isBiometricAvailable();
      setBiometricAvailable(isAvailable);

      if (isAvailable) {
        // Get biometric type
        const type = await biometricAuthService.getBiometricType();
        setBiometricType(type);

        // Check if biometric is enabled
        const isEnabled = await secureStorageService.isBiometricEnabled();
        setBiometricEnabled(isEnabled);
      }

      // Carregar configuração de privacidade do perfil
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('show_profile_in_shared')
          .eq('user_id', user.id)
          .single();

        if (!error && data) {
          // Se o campo existir, use-o; caso contrário, defina como true (padrão)
          setShowProfileInShared(data.show_profile_in_shared !== false);
        }
      }
    } catch (error) {
      error2('Erro!', 'Erro ao carregar as configurações')
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    try {
      setToggleLoading(true);

      if (value) {
        // Enable biometric
        // First check if we have credentials stored
        const credentials = await secureStorageService.getCredentials();

        if (!credentials) {
          Alert.alert(
            'Credenciais necessárias',
            'Para ativar a autenticação biométrica, você precisa fazer login novamente.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Fazer login',
                onPress: () => {
                  // Sign out and redirect to login
                  authService.signOut();
                  router.replace('/sign-in');
                }
              }
            ]
          );
          return;
        }

        // Authenticate with biometrics
        const isAuthenticated = await biometricAuthService.authenticate(
          `Configure ${biometricType} para login rápido`
        );

        if (isAuthenticated) {
          // Enable biometric authentication
          await secureStorageService.enableBiometric();
          setBiometricEnabled(true);
          success('Sucesso!', `${biometricType} ativado com sucesso!`);
        }
      } else {
        // Disable biometric
        await secureStorageService.disableBiometric();
        setBiometricEnabled(false);
        success('Sucesso!', `${biometricType} desativado com sucesso!`);
      }
    } catch (error) {
      error2('Erro!', 'Erro ao configurar a autenticação biométrica')
    } finally {
      setToggleLoading(false);
    }
  };

  const handleToggleProfilePrivacy = async (value: boolean) => {
    if (!user) return;
    
    try {
      setProfilePrivacyLoading(true);
      
      // Atualizar no banco de dados
      const { error } = await supabase
        .from('profiles')
        .update({ show_profile_in_shared: value })
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      setShowProfileInShared(value);
      success(
        'Configuração salva!', 
        value 
          ? 'Seu nome e foto serão exibidos nas telas compartilhadas' 
          : 'Seu nome e foto não serão exibidos nas telas compartilhadas'
      );
    } catch (error) {
      error2('Erro!', 'Não foi possível salvar sua configuração de privacidade');
    } finally {
      setProfilePrivacyLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await authService.signOut();
      router.replace('/sign-in');
    } catch (error) {
      error2('Erro!', 'Erro ao sair da conta')
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F163E0" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Configurações</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Segurança</Text>

          {biometricAvailable ? (
            <View style={styles.settingItem}>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Login com {biometricType}</Text>
                <Text style={styles.settingDescription}>
                  Use sua biometria para fazer login rapidamente sem digitar sua senha.
                </Text>
              </View>
              {toggleLoading ? (
                <ActivityIndicator size="small" color="#F163E0" />
              ) : (
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: '#D1D5DB', true: '#F163E0' }}
                  thumbColor="#FFFFFF"
                />
              )}
            </View>
          ) : (
            <View style={styles.settingItem}>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>Autenticação Biométrica</Text>
                <Text style={styles.settingDescription}>
                  Seu dispositivo não suporta autenticação biométrica ou não tem biometria configurada.
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacidade</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Mostrar perfil em áreas compartilhadas</Text>
              <Text style={styles.settingDescription}>
                Você quer mostrar seu nome e foto de perfil nas telas compartilhadas com as outras famílias? Exemplo: Comunidade e Ranking
              </Text>
            </View>
            {profilePrivacyLoading ? (
              <ActivityIndicator size="small" color="#F163E0" />
            ) : (
              <Switch
                value={showProfileInShared}
                onValueChange={handleToggleProfilePrivacy}
                trackColor={{ false: '#D1D5DB', true: '#F163E0' }}
                thumbColor="#FFFFFF"
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta</Text>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    color: '#111827',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  signOutButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SettingsScreen;