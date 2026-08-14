import { Stack } from 'expo-router';

export default function OperationsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'Operations' }} />
      <Stack.Screen name="select-site" options={{ title: 'Select Site' }} />
      <Stack.Screen name="drafts" options={{ title: 'Drafts' }} />
      <Stack.Screen name="submitted" options={{ title: 'Submitted Audits' }} />
      <Stack.Screen name="audit-form/[siteId]" options={{ title: 'Site Audit' }} />
    </Stack>
  );
}
