import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { getExercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import {
  deletePlan,
  getActivePlan,
  getPlanTree,
  listPlans,
  renamePlan,
  setActivePlan,
} from '@/db/repo/plans';
import { nextPlanDay } from '@/db/repo/sessions';
import { Button, Card, EmptyState, Input, Screen, SectionTitle, T } from '@/ui/components';
import { space } from '@/ui/theme';

export default function PlanScreen() {
  const active = useDbQuery(() => getActivePlan(db));
  const tree = useDbQuery(() => (active ? getPlanTree(db, active.id) : undefined), [active?.id]);
  const nextId = useDbQuery(
    () => (active ? nextPlanDay(db, active.id)?.id : undefined),
    [active?.id],
  );
  const others = useDbQuery(() => listPlans(db).filter((p) => !p.isActive));

  if (!tree) {
    return (
      <Screen>
        <EmptyState
          title="No plan yet"
          body="Create a plan, then add exercises to each training day."
          action={<Button title="Create plan" onPress={() => router.push('/plan/new')} />}
        />
      </Screen>
    );
  }

  const confirmDelete = () =>
    Alert.alert('Delete this plan?', 'Your workout history is kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePlan(db, tree.plan.id) },
    ]);

  return (
    <Screen>
      <PlanName key={tree.plan.id} planId={tree.plan.id} name={tree.plan.name} />
      <T variant="muted">
        {tree.plan.daysPerWeek} days a week · {tree.plan.sessionMinutes} min
      </T>

      {tree.days.map((day) => (
        <Card key={day.id} onPress={() => router.push(`/plan/day/${day.id}`)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="heading">{day.name}</T>
            {day.id === nextId ? <T variant="small">NEXT UP</T> : null}
          </View>
          <T variant="muted" numberOfLines={2}>
            {day.exercises.length === 0
              ? 'No exercises yet. Tap to add.'
              : day.exercises
                  .map((e) => getExercise(e.exerciseId)?.name ?? e.exerciseId)
                  .join(', ')}
          </T>
        </Card>
      ))}

      <Button
        title="New plan"
        variant="secondary"
        icon="add"
        onPress={() => router.push('/plan/new')}
      />

      {others.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <SectionTitle title="Other plans" />
          {others.map((p) => (
            <Card key={p.id}>
              <T variant="heading">{p.name}</T>
              <Button
                title="Use this plan"
                variant="ghost"
                onPress={() => setActivePlan(db, p.id)}
              />
            </Card>
          ))}
        </View>
      ) : null}

      <Button title="Delete plan" variant="danger" onPress={confirmDelete} />
    </Screen>
  );
}

function PlanName({ planId, name }: { planId: string; name: string }) {
  const [value, setValue] = useState(name);
  return (
    <Input
      accessibilityLabel="Plan name"
      value={value}
      onChangeText={setValue}
      onEndEditing={() => renamePlan(db, planId, value)}
      style={{ fontSize: 22, fontWeight: '700' }}
    />
  );
}
