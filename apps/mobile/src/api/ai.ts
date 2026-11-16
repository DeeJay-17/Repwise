import Constants from 'expo-constants';

import type { components } from './ai-service.generated';

export type GenerateRequest = components['schemas']['GenerateRequest'];
export type GenerateResponse = components['schemas']['GenerateResponse'];
export type PlanDocumentDto = components['schemas']['PlanDocument'];

export type GenerateResult =
  { ok: true; data: GenerateResponse } | { ok: false; code: string; message: string };

const TIMEOUT_MS = 120_000;

/**
 * Base URL of the AI service. EXPO_PUBLIC_AI_SERVICE_URL wins; otherwise app.json
 * extra.aiServiceUrl, whose default reaches a service on your computer from the
 * Android emulator.
 */
export function aiServiceUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_AI_SERVICE_URL;
  const fromConfig = Constants.expoConfig?.extra?.aiServiceUrl as string | undefined;
  return (fromEnv || fromConfig || 'http://10.0.2.2:8002').replace(/\/$/, '');
}

const FRIENDLY: Record<string, string> = {
  network: 'Could not reach the Repwise AI service. Check your connection and try again.',
  timeout: 'Generating took too long. Try again, or pick a faster model.',
};

export async function generatePlan(body: GenerateRequest, apiKey: string): Promise<GenerateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${aiServiceUrl()}/v1/plans/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-LLM-API-Key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: unknown = await response.json().catch(() => null);
    if (response.ok) return { ok: true, data: json as GenerateResponse };
    const err = json as { code?: string; message?: string } | null;
    if (err?.code && err.message) return { ok: false, code: err.code, message: err.message };
    return {
      ok: false,
      code: `http_${response.status}`,
      message: `The AI service returned ${response.status}.`,
    };
  } catch (e) {
    const code = (e as Error).name === 'AbortError' ? 'timeout' : 'network';
    return { ok: false, code, message: FRIENDLY[code]! };
  } finally {
    clearTimeout(timer);
  }
}
