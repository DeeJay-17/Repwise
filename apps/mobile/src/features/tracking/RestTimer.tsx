import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, Vibration, View } from 'react-native';

import { space, useColors } from '@/ui/theme';

export interface RestState {
  endsAt: number;
  total: number;
  label: string;
}

/** Rest timer state: start it when a set is ticked; it clears itself shortly after zero. */
export function useRestTimer() {
  const [rest, setRest] = useState<RestState | null>(null);
  const start = useCallback(
    (seconds: number, label: string) =>
      setRest(seconds > 0 ? { endsAt: Date.now() + seconds * 1000, total: seconds, label } : null),
    [],
  );
  const add = useCallback(
    (seconds: number) =>
      setRest((r) =>
        r ? { ...r, endsAt: r.endsAt + seconds * 1000, total: r.total + seconds } : r,
      ),
    [],
  );
  const stop = useCallback(() => setRest(null), []);
  return { rest, start, add, stop };
}

/** Docked bar with the countdown, "+15s" and "Skip". Vibrates once when rest is over. */
export function RestTimerBar({
  rest,
  onAdd,
  onSkip,
}: {
  rest: RestState;
  onAdd: () => void;
  onSkip: () => void;
}) {
  const c = useColors();
  const [now, setNow] = useState(() => Date.now());
  const buzzed = useRef(false);

  useEffect(() => {
    buzzed.current = false;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest.endsAt]);

  const left = Math.max(0, Math.round((rest.endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !buzzed.current) {
      buzzed.current = true;
      Vibration.vibrate(400);
    }
    if (now - rest.endsAt > 4000) onSkip();
  }, [left, now, rest.endsAt, onSkip]);

  const done = 1 - left / rest.total;
  const button = (title: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ color: c.background, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );

  return (
    <View style={{ backgroundColor: c.text }} accessibilityLiveRegion="polite">
      <View
        style={{ height: 3, width: `${Math.min(100, done * 100)}%`, backgroundColor: '#E3AE0E' }}
      />
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }}
      >
        <Text
          style={{
            color: left === 0 ? '#E3AE0E' : c.background,
            fontSize: 30,
            fontWeight: '800',
            minWidth: 80,
            fontVariant: ['tabular-nums'],
          }}
        >
          {Math.floor(left / 60)}:{(left % 60).toString().padStart(2, '0')}
        </Text>
        <Text
          style={{ color: c.background, opacity: 0.75, flex: 1, fontSize: 13 }}
          numberOfLines={2}
        >
          {left ? `Rest · next: ${rest.label}` : 'Rest over. Next set.'}
        </Text>
        {button('+15s', onAdd)}
        {button('Skip', onSkip)}
      </View>
    </View>
  );
}
