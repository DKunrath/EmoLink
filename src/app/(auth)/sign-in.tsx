"use client"

import * as LocalAuthentication from "expo-local-authentication";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import { router, useNavigation } from "expo-router";
import { authService } from "../../services/auth";
import { secureStorageService } from "../../services/secureStorage";
import { biometricAuthService } from "../../services/biometricAuth";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);

  const navigation = useNavigation();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Check for existing session and biometric authentication on component mount
  useEffect(() => {
    checkExistingSession();
  }, []);

  useEffect(() => {
    // Remover o título da rota
    navigation.setOptions({
      headerShown: false,
    });

    // Check biometric type available on device
    checkBiometricType();
  }, [navigation]);

  const checkExistingSession = async () => {
    try {
      setLoading(true);

      // Check if user is already signed in
      const isSignedIn = await authService.isSignedIn();

      if (isSignedIn) {
        // Check if biometric authentication is enabled
        const isBiometricEnabled = await secureStorageService.isBiometricEnabled();
        const isBiometricAvailable = await biometricAuthService.isBiometricAvailable();

        if (isBiometricEnabled && isBiometricAvailable) {
          // Automatically prompt for biometric authentication
          const biometricType = await biometricAuthService.getBiometricType();
          const result = await biometricAuthService.authenticate(
            `Autentique-se com ${biometricType} para continuar`
          );

          if (result) {
            // Authentication successful, navigate to home
            router.replace("/(tabs)/home");
            return;
          }
          // If biometric auth fails, let the user enter credentials manually
        }
      }
    } catch (error) {
      setError("Erro ao verificar sessão existente.");
    } finally {
      setLoading(false);
      setInitialAuthCheckDone(true);

      // Start animations after initial auth check
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const checkBiometricType = async () => {
    try {
      const isAvailable = await biometricAuthService.isBiometricAvailable();
      if (isAvailable) {
        const type = await biometricAuthService.getBiometricType();
        setBiometricType(type);
      }
    } catch (error) {
      setError("Erro ao verificar tipo de biometria.");
      setBiometricType(null);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      setLoading(true);
      setError("");

      const result = await biometricAuthService.authenticateAndSignIn();

      if (result.success) {
        // Navigate to home screen
        router.replace("/(tabs)/home");
      } else if (result.error) {
        setError(result.error);
      }
    } catch (error) {
      setError("Erro ao autenticar com biometria.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    // Validação básica
    if (!email.trim()) {
      setError("Preencha o campo de email!");
      return;
    }

    if (!password.trim()) {
      setError("Preencha o campo de senha!");
      return;
    }

    try {
      setLoading(true);
      setError("");

      if (Platform.OS === "web") {
        // Web-specific logic (if any)
        const { user, error: authError } = await authService.signIn(email, password);

        if (authError || !user) {
          throw new Error(authError || "Credenciais inválidas");
        }

        router.replace("/(tabs)/home");
      } else {
        // Login usando o serviço de autenticação
        const { user, error: authError } = await authService.signIn(email, password);

        if (authError || !user) {
          throw new Error(authError || "Credenciais inválidas");
        }

        // Check if biometric is available but not yet enabled
        const isBiometricAvailable = await biometricAuthService.isBiometricAvailable();
        const isBiometricEnabled = await secureStorageService.isBiometricEnabled();

        if (isBiometricAvailable && !isBiometricEnabled) {
          // Ask user if they want to enable biometric authentication
          Alert.alert(
            `Configurar ${biometricType}?`,
            `Deseja usar ${biometricType} para fazer login mais rapidamente na próxima vez?`,
            [
              {
                text: 'Agora não',
                style: 'cancel',
                onPress: () => router.replace("/(tabs)/home")
              },
              {
                text: 'Configurar',
                onPress: async () => {
                  try {
                    const authenticated = await biometricAuthService.authenticate(
                      `Configure ${biometricType} para login rápido`
                    );

                    if (authenticated) {
                      await secureStorageService.enableBiometric();
                      Alert.alert(
                        'Sucesso',
                        `${biometricType} configurado com sucesso!`,
                        [{ text: 'OK', onPress: () => router.replace("/(tabs)/home") }]
                      );
                    } else {
                      // User canceled or failed biometric auth
                      router.replace("/(tabs)/home");
                    }
                  } catch (error) {
                    Alert.alert('Erro', 'Ocorreu um erro ao configurar a autenticação biométrica.');
                    router.replace("/(tabs)/home");
                  }
                }
              }
            ]
          );
        } else {
          // Navigate to home screen
          router.replace("/(tabs)/home");
        }
      }
    } catch (err: any) {
      setError(err.message || "Email ou Senha Inválido!");
    } finally {
      setLoading(false);
    }
  };

  // Show loading indicator while checking for existing session
  if (loading && !initialAuthCheckDone) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F163E0" />
          <Text style={styles.loadingText}>Verificando sessão...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoid}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <Animated.View
              style={[
                styles.formContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.title}>Bem Vindo de Volta!</Text>
              <Text style={styles.subtitle}>Faça login para continuar registrando suas emoções.</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(""); // Clear error when user types
                  }}
                  placeholder="Informe seu e-mail"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Senha</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(""); // Clear error when user types
                  }}
                  placeholder="Informe sua senha"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                />
              </View>

              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.signInButton, loading && styles.signInButtonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.signInButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              {biometricType && (
                <TouchableOpacity
                  style={[styles.biometricButton, loading && styles.signInButtonDisabled]}
                  onPress={handleBiometricAuth}
                  disabled={loading}
                >
                  <Text style={styles.signInButtonText}>
                    Login com {biometricType}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.signUpLink} onPress={() => router.push("/sign-up")} disabled={loading}>
                <Text style={styles.signUpLinkText}>
                  Ainda não possui uma conta? <Text style={styles.signUpLinkTextBold}>Registre-se</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  formContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#111827",
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: "#B91C1C",
  },
  signInButton: {
    backgroundColor: "#F163E0",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  biometricButton: {
    backgroundColor: "#F163E0",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
    signUpLink: {
    alignItems: "center",
  },
  signUpLinkText: {
    fontSize: 14,
    color: "#6B7280",
  },
  signUpLinkTextBold: {
    fontWeight: "600",
    color: "#F163E0",
  },
});