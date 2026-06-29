// src/store/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import create from 'zustand';
import {persist} from 'zustand/middleware';
import apiClient from '../api/client';
import {storage} from '../lib/storage';
import type {UserProfile} from '../lib/types';

type AuthState = {
  token: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get): AuthState => ({
      token: null,
      refreshToken: null,
      user: null,
      isLoading: false,
      login: async (email, password) => {
        set({isLoading: true});
        try {
          const res = await apiClient.post('/auth/login', {email, password});
          const {accessToken, refreshToken, user} = res.data;
          await storage.setAccessToken(accessToken);
          await storage.setRefreshToken(refreshToken);
          await storage.setUser(user);
          set({token: accessToken, refreshToken, user});
        } catch (e) {
          console.error('Login error', e);
        } finally {
          set({isLoading: false});
        }
      },
      logout: async () => {
        set({isLoading: true});
        try {
          await apiClient.post('/auth/logout');
        } catch (_) {}
        await storage.clearTokens();
        await storage.clearUser();
        set({token: null, refreshToken: null, user: null});
        set({isLoading: false});
      },
      refreshUser: async () => {
        set({isLoading: true});
        try {
          const res = await apiClient.get('/auth/me');
          const user = res.data;
          await storage.setUser(user);
          set({user});
        } catch (_) {}
        set({isLoading: false});
      },
    }),
    {
      name: 'auth-store', // storage key
      getStorage: () => AsyncStorage, // using AsyncStorage for persistence
    },
  ),
);
