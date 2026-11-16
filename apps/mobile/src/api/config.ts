import Constants from 'expo-constants';

type ExtraKey = 'aiServiceUrl' | 'coreApiUrl' | 'googleWebClientId';

/** A value from app.json `extra`, or undefined when empty. */
export function extra(key: ExtraKey): string | undefined {
  const value = Constants.expoConfig?.extra?.[key] as string | undefined;
  return value || undefined;
}

/**
 * Base URL of a Repwise service, in this order:
 * 1. The given EXPO_PUBLIC_* variable, if set.
 * 2. The computer the dev server runs on (only known in development builds and Expo Go),
 *    on the service's local port. Works on a phone over Wi-Fi with no configuration.
 * 3. app.json `extra` (the deployed service).
 * 4. The Android emulator's address for the host computer.
 */
export function serviceUrl(fromEnv: string | undefined, extraKey: ExtraKey, port: number): string {
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (devHost) return `http://${devHost}:${port}`;
  return (extra(extraKey) ?? `http://10.0.2.2:${port}`).replace(/\/$/, '');
}

/** Read a JSON error body as {code, message}, with a fallback. */
export async function errorFrom(response: Response): Promise<{ code: string; message: string }> {
  const body = (await response.json().catch(() => null)) as {
    code?: string;
    message?: string;
  } | null;
  if (body?.code && body.message) return { code: body.code, message: body.message };
  return { code: `http_${response.status}`, message: `The server returned ${response.status}.` };
}
