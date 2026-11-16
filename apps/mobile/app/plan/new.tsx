import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { createPlan } from '@/db/repo/plans';
import { getProfile } from '@/db/repo/profile';
import { Button, Field, Input, Screen, Stepper, T } from '@/ui/components';
import { space } from '@/ui/theme';

export default function NewPlanScreen() {
  const profile = useDbQuery(() => getProfile(db));
  const [name, setName] = useState('My plan');
  const [days, setDays] = useState(profile?.daysPerWeek ?? 3);

  const create = () => {
    if (!profile) return;
    const planId = createPlan(db, {
      name,
      goal: profile.goal,
      daysPerWeek: days,
      sessionMinutes: profile.sessionMinutes,
    });
    router.dismissTo('/plan');
    return planId;
  };

  return (
    <Screen footer={<Button title="Create plan" onPress={create} />}>
      <Stack.Screen options={{ title: 'New plan' }} />
      <View style={{ gap: space.sm }}>
        <T variant="heading">Name</T>
        <Input value={name} onChangeText={setName} accessibilityLabel="Plan name" />
      </View>
      <Field label="Training days">
        <Stepper value={days} min={1} max={7} onChange={setDays} />
      </Field>
      <T variant="muted">
        You will get {days} empty day{days === 1 ? '' : 's'} to fill with exercises. Workouts rotate
        through them in order.
      </T>
    </Screen>
  );
}
