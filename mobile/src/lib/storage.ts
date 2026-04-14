import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
  CART_ID: 'cart_id',
  AGE_VERIFIED: 'age_verified',
};

export const storage = {
  async getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.ACCESS_TOKEN);
  },
  async setAccessToken(token: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.ACCESS_TOKEN, token);
  },
  async getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
  },
  async setRefreshToken(token: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.REFRESH_TOKEN, token);
  },
  async clearTokens(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.ACCESS_TOKEN);
    await AsyncStorage.removeItem(KEYS.REFRESH_TOKEN);
  },
  async getUser(): Promise<any | null> {
    const data = await AsyncStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : null;
  },
  async setUser(user: any): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },
  async clearUser(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.USER);
  },
  async getCartId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.CART_ID);
  },
  async setCartId(id: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.CART_ID, id);
  },
  async clearCartId(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.CART_ID);
  },
  async isAgeVerified(): Promise<boolean> {
    const val = await AsyncStorage.getItem(KEYS.AGE_VERIFIED);
    return val === 'true';
  },
  async setAgeVerified(): Promise<void> {
    await AsyncStorage.setItem(KEYS.AGE_VERIFIED, 'true');
  },
};
