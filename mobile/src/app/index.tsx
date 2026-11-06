import { Redirect } from 'expo-router';

import { useSession } from '@/auth/session';

/** The start: the overview for someone signed in, Log in for everyone else. */
export default function Index() {
  const { session } = useSession();
  return <Redirect href={session ? '/dashboard' : '/login'} />;
}
