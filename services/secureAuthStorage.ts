// services/secureAuthStorage.ts
import * as SecureStore from "expo-secure-store";

const KEYS = {
  accessToken: "grato_access_token",
  refreshToken: "grato_refresh_token",
  user: "grato_user",
  credentials: "grato_credentials", // for silent re-login fallback
};

export const secureAuthStorage = {
  async setSession(accessToken: string, user: object, refreshToken?: string | null) {
    await SecureStore.setItemAsync(KEYS.accessToken, accessToken);
    await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user));
    if (refreshToken) {
      await SecureStore.setItemAsync(KEYS.refreshToken, refreshToken);
    }
  },

  async setCredentials(email: string, password: string) {
    await SecureStore.setItemAsync(KEYS.credentials, JSON.stringify({ email, password }));
  },

  async getAccessToken() {
    return SecureStore.getItemAsync(KEYS.accessToken);
  },

  async getRefreshToken() {
    return SecureStore.getItemAsync(KEYS.refreshToken);
  },

  async getUser<T = any>(): Promise<T | null> {
    const raw = await SecureStore.getItemAsync(KEYS.user);
    return raw ? JSON.parse(raw) : null;
  },

  async getCredentials(): Promise<{ email: string; password: string } | null> {
    const raw = await SecureStore.getItemAsync(KEYS.credentials);
    return raw ? JSON.parse(raw) : null;
  },

  async updateAccessToken(accessToken: string) {
    await SecureStore.setItemAsync(KEYS.accessToken, accessToken);
  },

  async clearSession() {
    // Keep credentials so the next offline login attempt can still work if desired;
    // callers that want a full wipe should call clearAll() instead.
    await SecureStore.deleteItemAsync(KEYS.accessToken);
    await SecureStore.deleteItemAsync(KEYS.refreshToken);
    await SecureStore.deleteItemAsync(KEYS.user);
  },

  async clearAll() {
    await SecureStore.deleteItemAsync(KEYS.accessToken);
    await SecureStore.deleteItemAsync(KEYS.refreshToken);
    await SecureStore.deleteItemAsync(KEYS.user);
    await SecureStore.deleteItemAsync(KEYS.credentials);
  },
};
