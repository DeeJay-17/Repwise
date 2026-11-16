import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/features/profile/OnboardingContext';
import { useColors } from '@/ui/theme';

export default function OnboardingLayout() {
  const c = useColors();
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Welcome' }} />
        <Stack.Screen name="schedule" options={{ title: 'Your schedule' }} />
        <Stack.Screen name="limitations" options={{ title: 'Anything to avoid?' }} />
        <Stack.Screen name="equipment" options={{ title: 'Your equipment' }} />
      </Stack>
    </OnboardingProvider>
  );
}
