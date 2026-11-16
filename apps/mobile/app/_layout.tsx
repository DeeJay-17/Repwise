import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';

import { db } from '@/db/client';
import { useAutoSync } from '@/sync/runner';
import { T } from '@/ui/components';
import { useColors } from '@/ui/theme';

import migrations from '../drizzle/migrations';

export default function RootLayout() {
  const c = useColors();
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: c.background }}
      >
        <T variant="heading">Could not open your data</T>
        <T variant="muted">{error.message}</T>
      </View>
    );
  }
  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <>
      <AutoSync />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="exercise/[id]" options={{ presentation: 'modal', title: 'Exercise' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

/** Syncs the signed-in account in the background. Renders nothing. */
function AutoSync() {
  useAutoSync();
  return null;
}
