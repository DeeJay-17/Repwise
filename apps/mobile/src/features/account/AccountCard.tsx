import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { formatDay } from '@/lib/time';
import { lastSyncedAt } from '@/sync/engine';
import { runSync, useSyncStatus } from '@/sync/runner';
import { Button, Card, T } from '@/ui/components';
import { space, useColors } from '@/ui/theme';

import { deleteAccount, signIn, signOut } from './actions';
import { useAccount } from './session';

function syncedLabel(iso: string | undefined): string {
  if (!iso) return 'Not synced yet';
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes} min ago`;
  return `Synced ${formatDay(iso)}`;
}

/** Guest: offer Google sign-in. Signed in: who, sync status, sign out, delete account. */
export function AccountCard() {
  const c = useColors();
  const account = useAccount();
  const sync = useSyncStatus();
  const synced = useDbQuery(() => lastSyncedAt(db));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (account === undefined) return null;

  if (!account) {
    return (
      <Card>
        <T variant="heading">Guest mode</T>
        <T variant="muted">
          Your data is only on this phone. Sign in with Google to back it up and use it on other
          phones. Everything you have logged so far comes with you.
        </T>
        {busy ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <Button title="Sign in with Google" icon="logo-google" onPress={() => run(signIn)} />
        )}
        {error ? <T style={{ color: c.danger }}>{error}</T> : null}
      </Card>
    );
  }

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'Your account and everything synced to it are deleted from Repwise servers. This phone keeps its copy.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: () => run(deleteAccount) },
      ],
    );

  return (
    <Card>
      <T variant="heading">{account.user.name ?? account.user.email}</T>
      <T variant="muted">{account.user.email}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {sync.state === 'syncing' ? <ActivityIndicator size="small" color={c.primary} /> : null}
        <T variant="small" style={sync.state === 'error' ? { color: c.danger } : undefined}>
          {sync.state === 'syncing'
            ? 'Syncing…'
            : sync.state === 'error'
              ? `Sync failed: ${sync.message}`
              : syncedLabel(synced)}
        </T>
      </View>
      <Button
        title="Sync now"
        variant="secondary"
        icon="sync"
        disabled={busy}
        onPress={() => run(runSync)}
      />
      <Button title="Sign out" variant="ghost" disabled={busy} onPress={() => run(signOut)} />
      <Button title="Delete account" variant="danger" disabled={busy} onPress={confirmDelete} />
      {error ? <T style={{ color: c.danger }}>{error}</T> : null}
    </Card>
  );
}
