import { Redirect } from 'expo-router';

import { db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { getProfile } from '@/db/repo/profile';

/** Send new users to onboarding and everyone else to Today. */
export default function Index() {
  const profile = useDbQuery(() => getProfile(db));
  return <Redirect href={profile ? '/today' : '/onboarding'} />;
}
