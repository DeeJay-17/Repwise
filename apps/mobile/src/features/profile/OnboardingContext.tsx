import { createContext, useContext, useState, type ReactNode } from 'react';

import type { ProfileInput } from '@/db/repo/profile';
import { DEFAULT_WEIGHT_UNIT } from '@/lib/units';

interface OnboardingDraft extends Omit<ProfileInput, 'goal'> {
  goal: ProfileInput['goal'] | null;
}

const initial: OnboardingDraft = {
  goal: null,
  level: 'beginner',
  daysPerWeek: 3,
  sessionMinutes: 45,
  limitations: [],
  equipmentIds: [],
  weightUnit: DEFAULT_WEIGHT_UNIT,
};

const Ctx = createContext<{
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
} | null>(null);

/** Holds onboarding answers across its screens until the last step saves them. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(initial);
  const update = (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch }));
  return <Ctx.Provider value={{ draft, update }}>{children}</Ctx.Provider>;
}

export function useOnboarding() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return value;
}
