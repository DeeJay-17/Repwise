import { errorFrom, serviceUrl } from './config';

import type { components } from './ai-service.generated';

export type GenerateRequest = components['schemas']['GenerateRequest'];
export type GenerateResponse = components['schemas']['GenerateResponse'];
export type PlanDocumentDto = components['schemas']['PlanDocument'];

export type GenerateResult =
  { ok: true; data: GenerateResponse } | { ok: false; code: string; message: string };

const TIMEOUT_MS = 120_000;

/** Base URL of the AI service (local port 8002 in development). See serviceUrl. */
export function aiServiceUrl(): string {
  return serviceUrl(process.env.EXPO_PUBLIC_AI_SERVICE_URL, 'aiServiceUrl', 8002);
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
    if (response.ok) return { ok: true, data: (await response.json()) as GenerateResponse };
    return { ok: false, ...(await errorFrom(response)) };
  } catch (e) {
    const code = (e as Error).name === 'AbortError' ? 'timeout' : 'network';
    return { ok: false, code, message: FRIENDLY[code]! };
  } finally {
    clearTimeout(timer);
  }
}
