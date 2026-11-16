import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { exerciseImage, getEquipment, getExercise } from '@/catalogue';
import { MUSCLE_LABELS } from '@/domain/types';
import { Screen, T } from '@/ui/components';
import { radius, space } from '@/ui/theme';

export default function ExerciseInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = getExercise(id);
  if (!exercise) return null;
  const gear = exercise.equipment.map((e) => getEquipment(e)?.name).join(', ') || 'Bodyweight';
  const secondary = exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ');

  return (
    <Screen>
      <Stack.Screen options={{ title: exercise.name }} />
      <Image
        source={exerciseImage(exercise.id)}
        style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg }}
        contentFit="cover"
      />
      <View style={{ gap: space.xs }}>
        <T variant="title">{exercise.name}</T>
        <T variant="muted">
          Works: {exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}
        </T>
        {secondary ? <T variant="muted">Also: {secondary}</T> : null}
        <T variant="muted">Needs: {gear}</T>
      </View>
      <View style={{ gap: space.sm }}>
        <T variant="heading">How to</T>
        {exercise.instructions.map((step, i) => (
          <T key={i}>
            {i + 1}. {step}
          </T>
        ))}
      </View>
    </Screen>
  );
}
