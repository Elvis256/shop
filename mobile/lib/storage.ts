import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "user_data";
const CART_KEY = "cart_data";
const AGE_VERIFIED_KEY = "age_verified";
const WISHLIST_PIN_KEY = "wishlist_pin_verified";

// Secure storage for sensitive data (tokens)
export const secureStorage = {
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};

// Regular storage for non-sensitive data
export const storage = {
  async getUser(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setUser(user: any): Promise<void> {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  async clearUser(): Promise<void> {
    await AsyncStorage.removeItem(USER_KEY);
  },

  async getCart(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(CART_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async setCart(cart: any): Promise<void> {
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(cart));
  },

  async clearCart(): Promise<void> {
    await AsyncStorage.removeItem(CART_KEY);
  },

  async isAgeVerified(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(AGE_VERIFIED_KEY);
      return val === "true";
    } catch {
      return false;
    }
  },

  async setAgeVerified(verified: boolean): Promise<void> {
    await AsyncStorage.setItem(AGE_VERIFIED_KEY, verified ? "true" : "false");
  },

  async isWishlistPinVerified(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(WISHLIST_PIN_KEY);
      return val === "true";
    } catch {
      return false;
    }
  },

  async setWishlistPinVerified(verified: boolean): Promise<void> {
    await AsyncStorage.setItem(WISHLIST_PIN_KEY, verified ? "true" : "false");
  },

  async clearWishlistPinVerified(): Promise<void> {
    await AsyncStorage.removeItem(WISHLIST_PIN_KEY);
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([USER_KEY, CART_KEY, AGE_VERIFIED_KEY, WISHLIST_PIN_KEY]);
    await secureStorage.clearTokens();
  },
};
