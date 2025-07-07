// services/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

const CREDENTIALS_KEY = 'user_credentials';
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

interface StoredCredentials {
  email: string;
  password: string;
}

export const secureStorageService = {
  // Save user credentials securely
  async saveCredentials(email: string, password: string): Promise<void> {
    const credentials: StoredCredentials = { email, password };
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify(credentials)
    );
  },

  // Get stored credentials
  async getCredentials(): Promise<StoredCredentials | null> {
    const credentialsString = await SecureStore.getItemAsync(CREDENTIALS_KEY);
    if (!credentialsString) return null;
    
    try {
      return JSON.parse(credentialsString) as StoredCredentials;
    } catch (error) {
      return null;
    }
  },

  // Delete stored credentials
  async deleteCredentials(): Promise<void> {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
  },

  // Enable biometric authentication
  async enableBiometric(): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
  },

  // Check if biometric authentication is enabled
  async isBiometricEnabled(): Promise<boolean> {
    const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return value === 'true';
  },

  // Disable biometric authentication
  async disableBiometric(): Promise<void> {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  }
};