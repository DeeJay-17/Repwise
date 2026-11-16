import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { exerciseImage } from '@/catalogue';

import { radius, space, useColors } from './theme';

type TextVariant = 'title' | 'heading' | 'body' | 'muted' | 'small';

const textStyles: Record<TextVariant, TextStyle> = {
  title: { fontSize: 26, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16 },
  muted: { fontSize: 15 },
  small: { fontSize: 13 },
};

export function T({
  variant = 'body',
  style,
  children,
  numberOfLines,
}: {
  variant?: TextVariant;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  const c = useColors();
  const color = variant === 'muted' || variant === 'small' ? c.muted : c.text;
  return (
    <Text numberOfLines={numberOfLines} style={[textStyles[variant], { color }, style]}>
      {children}
    </Text>
  );
}

/** Scrollable page body with the app background and standard padding. */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            padding: space.lg,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: c.border,
            backgroundColor: c.card,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const base: ViewStyle = {
    backgroundColor: c.card,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  icon,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const c = useColors();
  const bg = {
    primary: c.primary,
    secondary: c.primarySoft,
    danger: 'transparent',
    ghost: 'transparent',
  }[variant];
  const fg = { primary: c.onPrimary, secondary: c.primary, danger: c.danger, ghost: c.primary }[
    variant
  ];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.md,
        paddingVertical: 14,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primarySoft : c.card,
      }}
    >
      <Text style={{ color: selected ? c.primary : c.text, fontWeight: selected ? '600' : '400' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A wrapping row of single- or multi-select chips. */
export function ChipGroup<V extends string | number>({
  options,
  isSelected,
  onToggle,
}: {
  options: readonly { value: V; label: string }[];
  isSelected: (value: V) => boolean;
  onToggle: (value: V) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => (
        <Chip
          key={String(o.value)}
          label={o.label}
          selected={isSelected(o.value)}
          onPress={() => onToggle(o.value)}
        />
      ))}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format = String,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
}) {
  const c = useColors();
  const button = (icon: 'remove' | 'add', next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon === 'add' ? 'Increase' : 'Decrease'}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: c.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={c.primary} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {button('remove', Math.max(min, value - step), value <= min)}
      <Text
        style={{
          color: c.text,
          fontSize: 18,
          fontWeight: '600',
          minWidth: 64,
          textAlign: 'center',
        }}
      >
        {format(value)}
      </Text>
      {button('add', Math.min(max, value + step), value >= max)}
    </View>
  );
}

/** A labelled row: label on the left, control on the right. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.md,
      }}
    >
      <T>{label}</T>
      {children}
    </View>
  );
}

export function Input({
  value,
  onChangeText,
  onEndEditing,
  placeholder,
  keyboardType = 'default',
  style,
  accessibilityLabel,
  secure,
  autoCapitalize,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onEndEditing?: () => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  secure?: boolean;
  autoCapitalize?: 'none' | 'sentences';
}) {
  const c = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onEndEditing={onEndEditing}
      placeholder={placeholder}
      placeholderTextColor={c.muted}
      keyboardType={keyboardType}
      accessibilityLabel={accessibilityLabel}
      secureTextEntry={secure}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCapitalize === 'none' ? false : undefined}
      returnKeyType="done"
      style={[
        {
          backgroundColor: c.input,
          color: c.text,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          paddingVertical: 10,
          fontSize: 16,
        },
        style,
      ]}
    />
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <T variant="heading">{title}</T>
      {action}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
      <T variant="heading">{title}</T>
      <T variant="muted" style={{ textAlign: 'center' }}>
        {body}
      </T>
      {action ? <View style={{ alignSelf: 'stretch', marginTop: space.sm }}>{action}</View> : null}
    </Card>
  );
}

export function ExerciseThumb({ exerciseId, size = 56 }: { exerciseId: string; size?: number }) {
  const c = useColors();
  return (
    <Image
      source={exerciseImage(exerciseId)}
      style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: c.input }}
      contentFit="cover"
      accessibilityIgnoresInvertColors
    />
  );
}

/** Two- or three-way toggle, e.g. kg / lb. */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: c.input,
        borderRadius: radius.md,
        padding: 3,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              paddingVertical: space.sm,
              paddingHorizontal: space.lg,
              borderRadius: radius.sm,
              backgroundColor: selected ? c.card : 'transparent',
            }}
          >
            <Text
              style={{ color: selected ? c.text : c.muted, fontWeight: selected ? '600' : '400' }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
