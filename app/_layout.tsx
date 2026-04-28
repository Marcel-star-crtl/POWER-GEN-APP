
import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';

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
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </I18nextProvider>
  );
}
