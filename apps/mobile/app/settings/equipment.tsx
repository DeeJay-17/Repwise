import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { db } from '@/db/client';
import { getProfile, updateProfile } from '@/db/repo/profile';
import { EquipmentPicker } from '@/features/catalogue/EquipmentPicker';
import { Button, Screen } from '@/ui/components';

export default function EditEquipmentScreen() {
  const [ids, setIds] = useState(() => getProfile(db)?.equipmentIds ?? []);
  const save = () => {
    updateProfile(db, { equipmentIds: ids });
    router.back();
  };
  return (
    <Screen footer={<Button title="Save" onPress={save} />}>
      <Stack.Screen options={{ title: 'Equipment' }} />
      <EquipmentPicker value={ids} onChange={setIds} />
    </Screen>
  );
}
