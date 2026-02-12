import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { Colors } from "../constants/Colors";
import { useAuth } from "../context/AuthContext";

export default function Index() {
  const { isAuthenticated, user, loading } = useAuth();

  // Show loading screen while checking auth
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 10, color: Colors.textSecondary }}>
          Loading...
        </Text>
      </View>
    );
  }

  // Redirect based on authentication state
  if (isAuthenticated && user?.role === "technician") {
    return <Redirect href="/(technician)/dashboard" />;
  }

  if (
    isAuthenticated &&
    (user?.role === "operations" || user?.role === "supervisor")
  ) {
    return <Redirect href="/(operations)/dashboard" />;
  }

  return <Redirect href="/(auth)/login" />;
}
