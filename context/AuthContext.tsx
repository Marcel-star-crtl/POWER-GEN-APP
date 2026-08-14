import { router } from "expo-router";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "../services/api";
import { authEvents } from "../services/authEvents";
import { secureAuthStorage } from "../services/secureAuthStorage";
import { startSyncManager } from "../services/syncManager";
import { getDb } from "../lib/db";
import { stopSharing } from "../services/technicianTracking";
import { isNetworkAvailable } from "../hooks/useNetworkStatus";
import { ApiResponse, AuthState, User } from "../types/common.types";
import { isTechnicianRole } from "../utils/roles";

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    loading: true,
    error: null,
  });
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      bootstrap();
    }

    const unsubscribe = authEvents.subscribe(() => {
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
        error: "Session expired",
      });
      router.replace("/(auth)/login");
    });

    return unsubscribe;
  }, []);

  const bootstrap = async () => {
    try {
      // DB must exist before any screen tries to read/write the offline queue.
      await getDb();

      const [token, user] = await Promise.all([
        secureAuthStorage.getAccessToken(),
        secureAuthStorage.getUser<User>(),
      ]);

      if (token && user) {
        setState((prev) => ({
          ...prev,
          accessToken: token,
          user,
          isAuthenticated: true,
          loading: false,
        }));
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }

      // Start draining the offline outbox / caching in the background.
      // Safe to call even if the user turns out to be logged out — it
      // simply won't have anything queued yet.
      startSyncManager();
    } catch (error) {
      console.error("Failed to load auth state:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedPassword = (password || "").replace(/\u00A0/g, " ").trim();

    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await api.post<
        ApiResponse<{ accessToken: string; refreshToken?: string; user: User }>
      >("/auth/login", { email: normalizedEmail, password: normalizedPassword });

      const { accessToken, refreshToken, user } = response.data.data!;

      if (
        !["technician", "ac", "data_collector", "operations", "supervisor", "fuel"].includes(
          user.role,
        )
      ) {
        throw new Error(
          "Access restricted to technicians, AC, fuel, operations, and supervisors only",
        );
      }

      await secureAuthStorage.setSession(accessToken, user, refreshToken);
      // Cached only to allow silent re-login / offline first-login fallback.
      await secureAuthStorage.setCredentials(normalizedEmail, normalizedPassword);

      setState({
        user,
        accessToken,
        refreshToken: refreshToken || null,
        isAuthenticated: true,
        loading: false,
        error: null,
      });

      if (user.role === "operations" || user.role === "supervisor") {
        router.replace("/(operations)/dashboard");
      } else {
        router.replace("/(technician)/dashboard");
      }
    } catch (error: any) {
      // FIX: this used to be `!error.response`, which is true for BOTH
      // "device has no internet" AND "device is online but can't reach
      // our API server" (wrong URL, server down, DNS failure, timeout,
      // a cold-starting free-tier host, etc.) — every one of those cases
      // showed the same "No internet connection" message even when the
      // device's connection was fine. Now checks the device's actual
      // network state (already built in hooks/useNetworkStatus.ts, just
      // never used here) so the two cases get the right message.
      const deviceHasNetwork = await isNetworkAvailable();
      const gotNoResponse = !error.response;
      const isDeviceOffline = gotNoResponse && !deviceHasNetwork;
      const isServerUnreachable = gotNoResponse && deviceHasNetwork;

      if (isDeviceOffline) {
        // Offline login: only works if this device has signed in successfully
        // at least once before (credentials + user cached at that time).
        const creds = await secureAuthStorage.getCredentials();
        const cachedUser = await secureAuthStorage.getUser<User>();
        const cachedToken = await secureAuthStorage.getAccessToken();

        if (
          creds &&
          cachedUser &&
          cachedToken &&
          creds.email === normalizedEmail &&
          creds.password === normalizedPassword &&
          isTechnicianRole(cachedUser?.role)
        ) {
          setState({
            user: cachedUser,
            accessToken: cachedToken,
            refreshToken: null,
            isAuthenticated: true,
            loading: false,
            error: null,
          });
          router.replace("/(technician)/dashboard");
          return;
        }

        const message = "No internet connection. Please connect once to enable offline login.";
        setState((prev) => ({ ...prev, loading: false, error: message }));
        throw new Error(message);
      }

      if (isServerUnreachable) {
        // Device has real internet, but nothing came back from the API —
        // this means the app is pointed at a server that's unreachable,
        // not that the device is offline. Common causes: wrong
        // EXPO_PUBLIC_API_URL for this build (see services/api.ts), the
        // backend is down, or it's cold-starting on a free-tier host.
        const message = "Can't reach the server right now. This isn't a connectivity problem on your device — please try again in a moment, or contact support if it persists.";
        setState((prev) => ({ ...prev, loading: false, error: message }));
        throw new Error(message);
      }

      const message = error.response?.data?.message || error.message || "Login failed";
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw new Error(message);
    }
  };

  const signOut = async () => {
    try {
      // Safety net: stops any active location-sharing loop regardless of
      // whether the technician properly checked out first — sharing
      // should never outlive the session it was tied to.
      stopSharing();
      await secureAuthStorage.clearAll();
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
        error: null,
      });
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};




