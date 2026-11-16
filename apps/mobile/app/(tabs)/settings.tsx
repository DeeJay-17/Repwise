import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { View } from 'react-native';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getProfile, updateProfile } from '@/db/repo/profile';
import { GOAL_LABELS } from '@/domain/types';
import type { WeightUnit } from '@/lib/units';
import { Card, Field, Screen, Segmented, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

const UNITS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const satisfies readonly { value: WeightUnit; label: string }[];

export default function SettingsScreen() {
  const c = useColors();
  const profile = useDbQuery(() => getProfile(db));
  if (!profile) return null;

  const row = (
    title: string,
    detail: string,
    href: '/settings/profile' | '/settings/equipment',
  ) => (
    <Card onPress={() => router.push(href)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <T variant="heading">{title}</T>
          <T variant="muted">{detail}</T>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.muted} />
      </View>
    </Card>
  );

  return (
    <Screen>
      {row(
        'Goals and schedule',
        `${GOAL_LABELS[profile.goal]} · ${profile.daysPerWeek} days · ${profile.sessionMinutes} min`,
        '/settings/profile',
      )}
      {row(
        'Equipment',
        profile.equipmentIds.length === 0
          ? 'Bodyweight only'
          : `${profile.equipmentIds.length} items`,
        '/settings/equipment',
      )}
      <Card>
        <Field label="Weight unit">
          <Segmented
            options={UNITS}
            value={profile.weightUnit}
            onChange={(weightUnit) => updateProfile(db, { weightUnit })}
          />
        </Field>
      </Card>
      <T variant="small">
        Exercise photos and instructions from free-exercise-db (public domain). Repwise{' '}
        {Constants.expoConfig?.version ?? ''}. Your data stays on this phone.
      </T>
    </Screen>
  );
}
