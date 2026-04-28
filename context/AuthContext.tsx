import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "../services/api";
import { ApiResponse, AuthState, User } from "../types/common.types";
import { isTechnicianRole } from "../utils/roles";

import { authEvents } from "../services/authEvents";

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
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
      loadStoredAuth();
    }

    // Subscribe to auth events (like 401 logout)
    const unsubscribe = authEvents.subscribe(() => {
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false,
        error: "Session expired",
      });
      // Only redirect if not already on login page
      if (!window.location?.pathname?.includes("/login")) {
        router.replace("/(auth)/login");
      }
    });

    return unsubscribe;
  }, []);

  const loadStoredAuth = async () => {
    try {
      console.log("🔄 Loading stored auth...");
      const [token, userStr] = await Promise.all([
        AsyncStorage.getItem("accessToken"),
        AsyncStorage.getItem("user"),
      ]);

      console.log("📦 Token exists:", !!token);
      console.log("📦 User exists:", !!userStr);

      if (token && userStr) {
        const user = JSON.parse(userStr);
        console.log("✅ Auth restored for:", user.email);
        console.log("👤 User role:", user.role);
        console.log("🔐 Is authenticated:", true);
        setState((prev) => ({
          ...prev,
          accessToken: token,
          user,
          isAuthenticated: true,
          loading: false,
        }));
        console.log("✅ State updated - should redirect now");
      } else {
        console.log("⚠️ No stored auth found");
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("❌ Failed to load auth state:", error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = (email || "").trim().toLowerCase();
    // Passwords typically should be treated verbatim, but copy/paste often adds
    // trailing whitespace/newlines that cause confusing "Invalid credentials".
    const normalizedPassword = (password || "").replace(/\u00A0/g, " ").trim();

    console.log("🔐 SignIn started for:", normalizedEmail);
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      console.log("📡 Sending login request...");
      const response = await api.post<
        ApiResponse<{ accessToken: string; refreshToken?: string; user: User }>
      >("/auth/login", {
        email: normalizedEmail,
        password: normalizedPassword,
      });

      console.log("✅ Login response received:", response.data);
      const { accessToken, refreshToken, user } = response.data.data!;

      console.log("👤 User role:", user.role);
      // Allow technicians, AC, operations, and supervisors
      if (
        ![
          "technician",
          "ac",
          "data_collector",
          "operations",
          "supervisor",
          "fuel",
        ].includes(user.role)
      ) {
        throw new Error(
          "Access restricted to technicians, AC, fuel, operations, and supervisors only",
        );
      }

      console.log("💾 Saving token and user to AsyncStorage...");
      await AsyncStorage.setItem("accessToken", accessToken);
      await AsyncStorage.setItem("user", JSON.stringify(user));
      await AsyncStorage.setItem(
        "offlineLogin",
        JSON.stringify({
          email: normalizedEmail,
          password: normalizedPassword,
        }),
      );

      console.log("✅ Token saved successfully");
      setState({
        user,
        accessToken,
        refreshToken: refreshToken || null,
        isAuthenticated: true,
        loading: false,
        error: null,
      });

      console.log("🚀 Navigating to dashboard...");
      if (user.role === "operations" || user.role === "supervisor") {
        router.replace("/(operations)/dashboard");
      } else {
        router.replace("/(technician)/dashboard");
      }
    } catch (error: any) {
      console.error("❌ Login error:", error);
      console.error("❌ Error response:", error.response?.data);
      const isNetworkError = !error.response;
      if (isNetworkError) {
        const offlineStr = await AsyncStorage.getItem("offlineLogin");
        const cachedUserStr = await AsyncStorage.getItem("user");
        const cachedToken = await AsyncStorage.getItem("accessToken");
        if (offlineStr && cachedUserStr) {
          try {
            const offline = JSON.parse(offlineStr);
            const cachedUser = JSON.parse(cachedUserStr);
            if (
              offline.email === normalizedEmail &&
              offline.password === normalizedPassword &&
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
          } catch {
            // fall through to normal error
          }
        }
        const message =
          "No internet connection. Please connect once to enable offline login.";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
        throw new Error(message);
      }

      const backendErrorText = [
        error.response?.data?.error,
        error.response?.data?.message,
        error.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const roleEnumMismatch =
        backendErrorText.includes("role") &&
        backendErrorText.includes("not a valid enum value") &&
        backendErrorText.includes("ac");

      const message = roleEnumMismatch
        ? "This account has an invalid server role configuration (ac). Please contact your administrator to update the role before signing in."
        : error.response?.data?.message || error.message || "Login failed";
      setState((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
      throw new Error(message);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem("accessToken");
      await AsyncStorage.removeItem("user");
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
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
