import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
// import '../global.css'; // Uncomment if using NativeWind

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(technician)" options={{ headerShown: false }} />
      <Stack.Screen name="(operations)" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
