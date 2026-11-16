import { router } from 'expo-router';

import { LimitationsPicker } from '@/features/profile/fields';
import { useOnboarding } from '@/features/profile/OnboardingContext';
import { Button, Screen, T } from '@/ui/components';

export default function LimitationsStep() {
  const { draft, update } = useOnboarding();
  return (
    <Screen
      footer={
        <Button
          title={draft.limitations.length ? 'Continue' : 'Skip'}
          onPress={() => router.push('/onboarding/equipment')}
        />
      }
    >
      <T variant="title">Anything to go easy on?</T>
      <T variant="muted">
        Optional. AI-generated plans will avoid stressing these areas. This is not medical advice;
        check with a professional if you have an injury.
      </T>
      <LimitationsPicker
        value={draft.limitations}
        onChange={(limitations) => update({ limitations })}
      />
    </Screen>
  );
}
