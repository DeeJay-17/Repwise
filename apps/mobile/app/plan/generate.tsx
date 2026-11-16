import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { generatePlan, type GenerateResponse } from '@/api/ai';
import { getExercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getActivePlan, getPlanTree, importPlanDocument } from '@/db/repo/plans';
import { getProfile } from '@/db/repo/profile';
import { formatTarget } from '@/domain/format';
import { buildGenerateRequest, toPlanDocument, type PlanDocument } from '@/domain/plan-document';
import { GOAL_LABELS, MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from '@/domain/types';
import { useAiSettings } from '@/features/ai/settings';
import { Button, Card, ChipGroup, EmptyState, ExerciseThumb, Screen, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; result: GenerateResponse };

const FOCUS_OPTIONS = MUSCLE_GROUPS.filter((m) => m !== 'full_body').map((m) => ({
  value: m,
  label: MUSCLE_LABELS[m],
}));

/** A plan document as stored by the app, from the server's response. */
function asPlanDocument(plan: GenerateResponse['plan']): PlanDocument {
  return plan as unknown as PlanDocument;
}

export default function GeneratePlanScreen() {
  const c = useColors();
  const { regenerate } = useLocalSearchParams<{ regenerate?: string }>();
  const [ai, reloadAi] = useAiSettings();
  useFocusEffect(reloadAi);
  const profile = useDbQuery(() => getProfile(db));
  const current = useDbQuery(() => {
    const active = getActivePlan(db);
    const tree = active ? getPlanTree(db, active.id) : undefined;
    return tree ? toPlanDocument(tree) : undefined;
  });
  const [focus, setFocus] = useState<MuscleGroup[]>(() => current?.focusMuscles ?? []);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (ai === undefined || !profile) return null;

  if (ai === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Generate a plan' }} />
        <EmptyState
          title="Add your API key first"
          body="AI plans use your own OpenAI, Google or Anthropic account. Add a key in Settings; it stays on this phone."
          action={<Button title="Set up AI" onPress={() => router.push('/settings/ai')} />}
        />
      </Screen>
    );
  }

  const shown = status.kind === 'done' ? asPlanDocument(status.result.plan) : undefined;
  const previous = shown ?? (regenerate && current?.days.length ? current : undefined);

  const run = async () => {
    setStatus({ kind: 'loading' });
    const result = await generatePlan(
      buildGenerateRequest(profile, ai, focus, previous),
      ai.apiKey,
    );
    setStatus(
      result.ok
        ? { kind: 'done', result: result.data }
        : { kind: 'error', message: result.message },
    );
  };

  const use = () => {
    if (!shown) return;
    importPlanDocument(db, shown, (id) => getExercise(id) !== undefined);
    router.dismissTo('/plan');
  };

  const toggleFocus = (m: MuscleGroup) =>
    setFocus((f) => (f.includes(m) ? f.filter((x) => x !== m) : [...f, m]));

  return (
    <Screen
      footer={
        status.kind === 'loading' ? (
          <View
            style={{
              flexDirection: 'row',
              gap: space.md,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color={c.primary} />
            <T variant="muted">Building your plan. This can take up to a minute.</T>
          </View>
        ) : shown ? (
          <View style={{ gap: space.sm }}>
            <Button title="Use this plan" icon="checkmark" onPress={use} />
            <Button title="Regenerate" variant="secondary" icon="refresh" onPress={run} />
          </View>
        ) : (
          <Button
            title={previous ? 'Regenerate plan' : 'Generate plan'}
            icon="sparkles"
            onPress={run}
          />
        )
      }
    >
      <Stack.Screen options={{ title: previous ? 'Regenerate plan' : 'Generate a plan' }} />
      <Card>
        <T variant="heading">{GOAL_LABELS[profile.goal]}</T>
        <T variant="muted">
          {profile.daysPerWeek} days a week · {profile.sessionMinutes} min ·{' '}
          {profile.equipmentIds.length === 0
            ? 'bodyweight only'
            : `${profile.equipmentIds.length} equipment items`}
        </T>
        <Button
          title="Change goals"
          variant="ghost"
          onPress={() => router.push('/settings/profile')}
        />
      </Card>

      <View style={{ gap: space.sm }}>
        <T variant="heading">Focus on (optional)</T>
        <ChipGroup
          options={FOCUS_OPTIONS}
          isSelected={(m) => focus.includes(m)}
          onToggle={toggleFocus}
        />
      </View>

      {status.kind === 'error' ? (
        <Card style={{ borderColor: c.danger }}>
          <T style={{ color: c.danger }}>{status.message}</T>
        </Card>
      ) : null}

      {shown && status.kind === 'done' ? (
        <PlanPreview plan={shown} warnings={status.result.warnings} />
      ) : null}
    </Screen>
  );
}

function PlanPreview({ plan, warnings }: { plan: PlanDocument; warnings: string[] }) {
  return (
    <View style={{ gap: space.md }}>
      <T variant="title">{plan.name}</T>
      {warnings.map((w) => (
        <Card key={w}>
          <T variant="small">{w}</T>
        </Card>
      ))}
      {plan.days.map((day) => (
        <Card key={day.dayIndex}>
          <T variant="heading">{day.name}</T>
          {day.exercises.map((e) => (
            <View
              key={e.order}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
            >
              <ExerciseThumb exerciseId={e.exerciseId} size={40} />
              <View style={{ flex: 1 }}>
                <T numberOfLines={1}>{getExercise(e.exerciseId)?.name ?? e.exerciseId}</T>
                <T variant="small">
                  {formatTarget({
                    sets: e.sets,
                    targetKind: e.target.kind,
                    minReps: e.target.kind === 'reps' ? e.target.minReps : null,
                    maxReps: e.target.kind === 'reps' ? e.target.maxReps : null,
                    seconds: e.target.kind === 'time' ? e.target.seconds : null,
                  })}
                </T>
              </View>
            </View>
          ))}
        </Card>
      ))}
      <T variant="small">General fitness guidance, not medical advice.</T>
    </View>
  );
}
