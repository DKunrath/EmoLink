// services/auth.ts
import { supabase } from './supabase';
import { secureStorageService } from './secureStorage';
import { User } from '../types';
import { Platform } from 'react-native';

export const authService = {
  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    try {
      // If on web platform, use the web sign-in method
      if (Platform.OS === 'web') {
        return this.signInWeb(email, password);
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // If login is successful, save credentials for biometric auth
      await secureStorageService.saveCredentials(email, password);
      
      return { 
        user: data.user, 
        weakPassword: false, 
        error: null 
      };
    } catch (error) {
      if (error instanceof Error) {
        return { 
          user: null, 
          weakPassword: false, 
          error: error.message 
        };
      } else {
        return { 
          user: null, 
          weakPassword: false, 
          error: 'Ocorreu um erro desconhecido.' 
        };
      }
    }
  },

  // New method specifically for web login
  async signInWeb(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      return { 
        user: data.user, 
        weakPassword: false, 
        error: null 
      };
    } catch (error) {
      if (error instanceof Error) {
        return { 
          user: null, 
          weakPassword: false, 
          error: error.message 
        };
      } else {
        return { 
          user: null, 
          weakPassword: false, 
          error: 'Ocorreu um erro desconhecido.' 
        };
      }
    }
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Skip secure storage operations on web
      if (Platform.OS !== 'web') {
        // Clear stored credentials when signing out
        await secureStorageService.deleteCredentials();
        await secureStorageService.disableBiometric();
      }
      
      return { success: true, error: null };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred.' 
      };
    }
  },

  async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      return user;
    } catch (error) {
      return null;
    }
  },
  
  async isSignedIn() {
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch (error) {
      return false;
    }
  }
};