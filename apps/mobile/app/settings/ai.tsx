import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import {
  clearAiSettings,
  maskKey,
  PROVIDERS,
  saveAiSettings,
  useAiSettings,
  type AiSettings,
  type ProviderId,
} from '@/features/ai/settings';
import { Button, Card, Input, Screen, Segmented, T } from '@/ui/components';
import { space } from '@/ui/theme';

export default function AiSettingsScreen() {
  const [saved] = useAiSettings();
  if (saved === undefined) return null;
  return <AiSettingsForm saved={saved} />;
}

function AiSettingsForm({ saved }: { saved: AiSettings | null }) {
  const [provider, setProvider] = useState<ProviderId>(saved?.provider ?? 'openai');
  const [model, setModel] = useState(saved?.model ?? '');
  const [apiKey, setApiKey] = useState('');

  const keyToSave = apiKey.trim() || saved?.apiKey || '';
  const canSave = model.trim().length > 0 && keyToSave.length >= 8;

  const save = async () => {
    await saveAiSettings({ provider, model, apiKey: keyToSave });
    router.back();
  };

  const remove = () =>
    Alert.alert('Remove your API key?', 'AI plan generation will be off until you add one again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await clearAiSettings();
          router.back();
        },
      },
    ]);

  return (
    <Screen footer={<Button title="Save" disabled={!canSave} onPress={save} />}>
      <Stack.Screen options={{ title: 'AI plan generation' }} />
      <T variant="muted">
        Repwise generates plans with your own account at a model provider. You pay the provider
        directly; a plan costs a fraction of a cent on most small models.
      </T>

      <View style={{ gap: space.sm }}>
        <T variant="heading">Provider</T>
        <Segmented options={PROVIDERS} value={provider} onChange={setProvider} />
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="heading">Model</T>
        <Input
          value={model}
          onChangeText={setModel}
          placeholder={"Model name from your provider's docs"}
          autoCapitalize="none"
          accessibilityLabel="Model name"
        />
        <T variant="small">
          Use a model that supports structured output (JSON). Smaller, faster models work well.
        </T>
      </View>

      <View style={{ gap: space.sm }}>
        <T variant="heading">API key</T>
        <Input
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={saved ? `Saved: ${maskKey(saved.apiKey)}` : 'Paste your API key'}
          secure
          autoCapitalize="none"
          accessibilityLabel="API key"
        />
      </View>

      <Card>
        <T variant="small">
          Your key is stored only in this phone&apos;s secure storage and is not synced. When you
          generate a plan it is sent over HTTPS to the Repwise AI service, used for that one
          request, and never stored or logged.
        </T>
      </Card>

      {saved ? <Button title="Remove API key" variant="danger" onPress={remove} /> : null}
    </Screen>
  );
}
