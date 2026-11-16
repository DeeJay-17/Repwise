import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { db } from '@/db/client';
import { getProfile } from '@/db/repo/profile';
import { signIn } from '@/features/account/actions';
import { Button, Card, Screen, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

export default function WelcomeStep() {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!(await signIn())) return;
      // A returning user's profile arrives with the first sync.
      router.replace(getProfile(db) ? '/today' : '/onboarding/goal');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          {busy ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <>
              <Button title="Sign in with Google" icon="logo-google" onPress={google} />
              <Button
                title="Continue as guest"
                variant="secondary"
                onPress={() => router.push('/onboarding/goal')}
              />
            </>
          )}
        </View>
      }
    >
      <View style={{ gap: space.sm, marginTop: space.xl }}>
        <Text
          style={{ color: c.text, fontSize: 44, fontWeight: '800', textTransform: 'uppercase' }}
        >
          Repwise
        </Text>
        <T variant="muted">Plans that fit your goals and the equipment you actually have.</T>
      </View>
      <Card>
        <T style={{ fontWeight: '700' }}>With a Google account</T>
        <T variant="muted">Back up your plans and workouts and use them on more than one phone.</T>
      </Card>
      <Card>
        <T style={{ fontWeight: '700' }}>As a guest</T>
        <T variant="muted">Everything stays on this phone. You can sign in later from Settings.</T>
      </Card>
      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
    </Screen>
  );
}
