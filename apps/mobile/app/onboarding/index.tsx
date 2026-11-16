import { router } from 'expo-router';

import { GoalPicker } from '@/features/profile/fields';
import { useOnboarding } from '@/features/profile/OnboardingContext';
import { Button, Screen, T } from '@/ui/components';

export default function GoalStep() {
  const { draft, update } = useOnboarding();
  return (
    <Screen
      footer={
        <Button
          title="Continue"
          disabled={!draft.goal}
          onPress={() => router.push('/onboarding/schedule')}
        />
      }
    >
      <T variant="title">What are you training for?</T>
      <T variant="muted">Repwise builds your plan around this. You can change it later.</T>
      <GoalPicker value={draft.goal} onChange={(goal) => update({ goal })} />
    </Screen>
  );
}
