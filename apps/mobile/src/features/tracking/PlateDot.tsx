import { useColorScheme, View } from 'react-native';

import { PLATE_HEX, type PlateColor } from '@/domain/day-colors';

/** A small round "bumper plate" in a day's colour. */
export function PlateDot({ color, size = 12 }: { color: PlateColor; size?: number }) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: PLATE_HEX[color][scheme],
        borderWidth: 1,
        borderColor: scheme === 'dark' ? 'rgba(231,235,236,0.35)' : 'rgba(21,26,30,0.28)',
      }}
    />
  );
}
