import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';

import {
  equipment,
  equipmentImage,
  equipmentPresets,
  EQUIPMENT_CATEGORY_LABELS,
  type EquipmentCategory,
} from '@/catalogue';
import { Chip, T } from '@/ui/components';
import { radius, space, useColors } from '@/ui/theme';

const CATEGORIES = Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentCategory[];

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Presets plus a photo grid of every equipment item, grouped by category. */
export function EquipmentPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const c = useColors();
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <T variant="heading">Quick start</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {equipmentPresets.map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              selected={sameSet(p.equipmentIds, value)}
              onPress={() => onChange([...p.equipmentIds])}
            />
          ))}
        </View>
        <T variant="small">
          {value.length === 0
            ? 'Bodyweight exercises only. Add anything you have access to.'
            : `${value.length} selected. Bodyweight exercises are always included.`}
        </T>
      </View>

      {CATEGORIES.map((cat) => (
        <View key={cat} style={{ gap: space.sm }}>
          <T variant="heading">{EQUIPMENT_CATEGORY_LABELS[cat]}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {equipment
              .filter((e) => e.category === cat)
              .map((e) => {
                const selected = value.includes(e.id);
                return (
                  <Pressable
                    key={e.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={e.name}
                    onPress={() => toggle(e.id)}
                    style={{
                      width: '48%',
                      borderRadius: radius.md,
                      overflow: 'hidden',
                      borderWidth: 2,
                      borderColor: selected ? c.primary : c.border,
                      backgroundColor: c.card,
                    }}
                  >
                    <Image
                      source={equipmentImage(e.id)}
                      style={{ width: '100%', aspectRatio: 4 / 3, opacity: selected ? 1 : 0.85 }}
                      contentFit="cover"
                    />
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: space.sm,
                        gap: space.xs,
                      }}
                    >
                      <Text style={{ color: c.text, flex: 1, fontWeight: '500' }} numberOfLines={2}>
                        {e.name}
                      </Text>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={selected ? c.primary : c.muted}
                      />
                    </View>
                  </Pressable>
                );
              })}
          </View>
        </View>
      ))}
    </View>
  );
}
