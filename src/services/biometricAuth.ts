// services/biometricAuth.ts
import * as LocalAuthentication from 'expo-local-authentication';
import { secureStorageService } from './secureStorage';
import { authService } from './auth';

export const biometricAuthService = {
  // Check if biometric authentication is available
  async isBiometricAvailable(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  },

  // Get the type of biometric authentication available
  async getBiometricType(): Promise<string> {
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    
    if (supportedTypes.includes(2)) {
      return 'Face ID';
    } else if (supportedTypes.includes(1)) {
      return 'Touch ID';
    } else {
      return 'Biometria';
    }
  },

  // Authenticate using biometrics
  async authenticate(promptMessage?: string): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || 'Autentique-se para continuar',
        disableDeviceFallback: false,
        cancelLabel: 'Cancelar',
      });
      
      return result.success;
    } catch (error) {
      return false;
    }
  },

  // Authenticate and sign in
  async authenticateAndSignIn(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if biometric is enabled
      const isBiometricEnabled = await secureStorageService.isBiometricEnabled();
      if (!isBiometricEnabled) {
        return { success: false, error: 'Biometric authentication not enabled' };
      }

      // Get stored credentials
      const credentials = await secureStorageService.getCredentials();
      if (!credentials) {
        return { success: false, error: 'No stored credentials found' };
      }

      // Authenticate with biometrics
      const biometricType = await this.getBiometricType();
      const isAuthenticated = await this.authenticate(`Autentique-se com ${biometricType}`);
      
      if (!isAuthenticated) {
        return { success: false, error: 'Biometric authentication failed' };
      }

      // Sign in with stored credentials
      const { user, error } = await authService.signIn(credentials.email, credentials.password);
      
      if (error || !user) {
        return { success: false, error: error || 'Authentication failed' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }
};