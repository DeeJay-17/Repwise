import { useColorScheme } from 'react-native';

const light = {
  background: '#F6F7F9',
  card: '#FFFFFF',
  text: '#11151C',
  muted: '#5B6573',
  border: '#E1E5EB',
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  primarySoft: '#E6EEFD',
  danger: '#DC2626',
  success: '#16A34A',
  successSoft: '#E7F6EC',
  input: '#F1F3F6',
};

const dark: typeof light = {
  background: '#0E1116',
  card: '#171B22',
  text: '#F2F4F7',
  muted: '#9AA4B2',
  border: '#2A303A',
  primary: '#5B8DEF',
  onPrimary: '#FFFFFF',
  primarySoft: '#1D2A44',
  danger: '#F05252',
  success: '#31C46B',
  successSoft: '#163323',
  input: '#202631',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
