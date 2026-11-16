import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import { filterExercises, getEquipment, type Exercise } from '@/catalogue';
import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { addPlannedExercise, defaultTarget } from '@/db/repo/plans';
import { getProfile } from '@/db/repo/profile';
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from '@/domain/types';
import { Button, Chip, ExerciseThumb, Input, T } from '@/ui/components';
import { radius, space, useColors } from '@/ui/theme';

export default function ExercisePickerScreen() {
  const c = useColors();
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const equipmentIds = useDbQuery(() => getProfile(db)?.equipmentIds ?? []);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [added, setAdded] = useState<Record<string, number>>({});

  const results = useMemo(
    () => filterExercises({ equipmentIds, muscle, query }),
    [equipmentIds, muscle, query],
  );

  const add = (e: Exercise) => {
    addPlannedExercise(db, dayId, e.id, defaultTarget(e.defaultTarget, e.category === 'cardio'));
    setAdded((a) => ({ ...a, [e.id]: (a[e.id] ?? 0) + 1 }));
  };
  const total = Object.values(added).reduce((s, n) => s + n, 0);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <Stack.Screen options={{ title: 'Add exercises' }} />
      <View style={{ padding: space.lg, gap: space.md }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises"
          accessibilityLabel="Search"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm }}
        >
          <Chip label="All" selected={muscle === null} onPress={() => setMuscle(null)} />
          {MUSCLE_GROUPS.filter((m) => m !== 'full_body').map((m) => (
            <Chip
              key={m}
              label={MUSCLE_LABELS[m]}
              selected={muscle === m}
              onPress={() => setMuscle(m)}
            />
          ))}
        </ScrollView>
        <T variant="small">
          {results.length} exercises for your equipment.{' '}
          <T variant="small" style={{ color: c.primary }}>
            Edit equipment in Settings.
          </T>
        </T>
      </View>
      <FlatList
        data={results}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: space.xl,
          gap: space.sm,
        }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const count = added[item.id] ?? 0;
          const gear =
            item.equipment.map((id) => getEquipment(id)?.name).join(', ') || 'Bodyweight';
          return (
            <Pressable
              onPress={() => add(item)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                padding: space.sm,
                borderRadius: radius.md,
                backgroundColor: count ? c.successSoft : c.card,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <ExerciseThumb exerciseId={item.id} />
              <View style={{ flex: 1 }}>
                <T numberOfLines={1}>{item.name}</T>
                <T variant="small" numberOfLines={1}>
                  {item.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {gear}
                </T>
              </View>
              <Pressable
                hitSlop={10}
                accessibilityLabel={`About ${item.name}`}
                onPress={() => router.push(`/exercise/${item.id}`)}
              >
                <Ionicons name="information-circle-outline" size={24} color={c.muted} />
              </Pressable>
              <Ionicons
                name={count ? 'checkmark-circle' : 'add-circle-outline'}
                size={26}
                color={count ? c.success : c.primary}
              />
            </Pressable>
          );
        }}
      />
      <View style={{ padding: space.lg, backgroundColor: c.card }}>
        <Button title={total ? `Done (${total} added)` : 'Done'} onPress={() => router.back()} />
      </View>
    </View>
  );
}
