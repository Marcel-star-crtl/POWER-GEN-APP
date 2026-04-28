import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Colors } from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";

import { useTranslation } from "react-i18next";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, loading, error } = useAuth();
  const { t } = useTranslation();

  const handleLogin = async () => {
    try {
      if (!email || !password) {
        // Simple validation would normally be handled by a form library or helper
        return;
      }
      await signIn(email, password);
    } catch (e) {
      // Error is handled in context
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t("login.title", "Grato")}</Text>
          <Text style={styles.subtitle}>
            {t("login.subtitle", "Technician Portal")}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.welcome}>
            {t("login.welcome", "Welcome Back")}
          </Text>
          <Text style={styles.instruction}>
            {t("login.instruction", "Sign in to access your tasks")}
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Input
            label={t("login.emailLabel", "Email or Phone")}
            placeholder={t(
              "login.emailPlaceholder",
              "technician@grato.com / 080...",
            )}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Input
            label={t("login.passwordLabel", "Password")}
            placeholder={t("login.passwordPlaceholder", "••••••••")}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Button
            onPress={handleLogin}
            loading={loading}
            size="lg"
            style={styles.loginButton}
          >
            {t("login.signInButton", "Sign In")}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  form: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  welcome: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  instruction: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: "center",
  },
  logo: {
    width: 90,
    height: 90,
    marginBottom: 12,
  },
  errorContainer: {
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
  },
  loginButton: {
    marginTop: 8,
  },
});
