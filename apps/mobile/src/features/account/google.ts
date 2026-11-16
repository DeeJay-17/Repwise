import Constants, { ExecutionEnvironment } from 'expo-constants';

import { extra } from '@/api/config';

export class GoogleSignInUnavailable extends Error {}

/** Expo Go cannot load Google's native sign-in; it needs the Repwise development build. */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function webClientId(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || extra('googleWebClientId');
}

/**
 * Show Google's account picker and return a Google ID token for the Repwise server,
 * or null if the user cancelled.
 */
export async function googleIdToken(): Promise<string | null> {
  if (isExpoGo()) {
    throw new GoogleSignInUnavailable(
      'Google sign-in needs the Repwise development build; Expo Go cannot load it. Guest mode works here.',
    );
  }
  const clientId = webClientId();
  if (!clientId) {
    throw new GoogleSignInUnavailable(
      'Google sign-in is not configured: set the Google web client ID.',
    );
  }
  // Loaded lazily so Expo Go, which lacks the native module, never imports it.
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: clientId });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') return null;
  if (!result.data.idToken) throw new Error('Google did not return an ID token.');
  return result.data.idToken;
}

export async function googleSignOut(): Promise<void> {
  if (isExpoGo()) return;
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  await GoogleSignin.signOut().catch(() => undefined);
}
