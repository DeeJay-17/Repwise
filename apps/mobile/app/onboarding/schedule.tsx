import { router } from 'expo-router';

import { ScheduleFields } from '@/features/profile/fields';
import { useOnboarding } from '@/features/profile/OnboardingContext';
import { Button, Screen, T } from '@/ui/components';

export default function ScheduleStep() {
  const { draft, update } = useOnboarding();
  return (
    <Screen
      footer={<Button title="Continue" onPress={() => router.push('/onboarding/limitations')} />}
    >
      <T variant="title">How much can you train?</T>
      <ScheduleFields
        level={draft.level}
        daysPerWeek={draft.daysPerWeek}
        sessionMinutes={draft.sessionMinutes}
        onChange={update}
      />
    </Screen>
  );
}
