import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db/client';
import { getProfile, updateProfile } from '@/db/repo/profile';
import { GoalPicker, LimitationsPicker, ScheduleFields } from '@/features/profile/fields';
import { Button, Screen, T } from '@/ui/components';
import { space } from '@/ui/theme';

export default function EditProfileScreen() {
  const [draft, setDraft] = useState(() => getProfile(db));
  if (!draft) return null;
  const update = (patch: Partial<typeof draft>) => setDraft({ ...draft, ...patch });

  const save = () => {
    const { goal, level, daysPerWeek, sessionMinutes, limitations } = draft;
    updateProfile(db, { goal, level, daysPerWeek, sessionMinutes, limitations });
    router.back();
  };

  return (
    <Screen footer={<Button title="Save" onPress={save} />}>
      <Stack.Screen options={{ title: 'Goals and schedule' }} />
      <T variant="heading">Goal</T>
      <GoalPicker value={draft.goal} onChange={(goal) => update({ goal })} />
      <ScheduleFields
        level={draft.level}
        daysPerWeek={draft.daysPerWeek}
        sessionMinutes={draft.sessionMinutes}
        onChange={update}
      />
      <View style={{ gap: space.sm }}>
        <T variant="heading">Go easy on</T>
        <LimitationsPicker
          value={draft.limitations}
          onChange={(limitations) => update({ limitations })}
        />
      </View>
      <T variant="small">Changes apply to new plans. Your current plan stays as it is.</T>
    </Screen>
  );
}
