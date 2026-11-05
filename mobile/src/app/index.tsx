import { Redirect } from 'expo-router';

/** The app opens on the dashboard, as the web does after sign-in. Sign-in will sit in front of it. */
export default function Index() {
  return <Redirect href="/dashboard" />;
}
