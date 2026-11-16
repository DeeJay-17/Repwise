import { router } from 'expo-router';

import { db } from '@/db/client';
import { saveProfile } from '@/db/repo/profile';
import { EquipmentPicker } from '@/features/catalogue/EquipmentPicker';
import { useOnboarding } from '@/features/profile/OnboardingContext';
import { Button, Screen, T } from '@/ui/components';

export default function EquipmentStep() {
  const { draft, update } = useOnboarding();

  const finish = () => {
    if (!draft.goal) return;
    saveProfile(db, { ...draft, goal: draft.goal });
    router.replace('/today');
  };

  return (
    <Screen footer={<Button title="Finish" onPress={finish} />}>
      <T variant="title">What can you use?</T>
      <T variant="muted">Pick a starting point, then add or remove items.</T>
      <EquipmentPicker
        value={draft.equipmentIds}
        onChange={(equipmentIds) => update({ equipmentIds })}
      />
    </Screen>
  );
}
