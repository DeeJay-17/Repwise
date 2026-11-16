import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

/**
 * The user's own model provider settings. The API key lives only in the phone's secure
 * storage (Keychain / Keystore); it is never written to the database or synced.
 */
export const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'google', label: 'Google' },
  { value: 'anthropic', label: 'Anthropic' },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]['value'];

export interface AiSettings {
  provider: ProviderId;
  model: string;
  apiKey: string;
}

const KEYS = {
  provider: 'repwise.ai.provider',
  model: 'repwise.ai.model',
  apiKey: 'repwise.ai.apiKey',
} as const;

export async function loadAiSettings(): Promise<AiSettings | null> {
  const [provider, model, apiKey] = await Promise.all([
    SecureStore.getItemAsync(KEYS.provider),
    SecureStore.getItemAsync(KEYS.model),
    SecureStore.getItemAsync(KEYS.apiKey),
  ]);
  if (!provider || !model || !apiKey) return null;
  return { provider: provider as ProviderId, model, apiKey };
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.provider, settings.provider),
    SecureStore.setItemAsync(KEYS.model, settings.model.trim()),
    SecureStore.setItemAsync(KEYS.apiKey, settings.apiKey.trim()),
  ]);
}

export async function clearAiSettings(): Promise<void> {
  await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
}

/** Settings plus a reload function. `undefined` while loading, `null` when not set up. */
export function useAiSettings(): [AiSettings | null | undefined, () => void] {
  const [settings, setSettings] = useState<AiSettings | null | undefined>(undefined);
  const reload = useCallback(() => {
    loadAiSettings().then(setSettings, () => setSettings(null));
  }, []);
  useEffect(reload, [reload]);
  return [settings, reload];
}

/** "sk-...1234" style preview, so the full key is never shown again after saving. */
export function maskKey(key: string): string {
  return key.length <= 8 ? '••••' : `${key.slice(0, 3)}…${key.slice(-4)}`;
}
