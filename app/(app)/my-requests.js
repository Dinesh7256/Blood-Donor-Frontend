import { Redirect } from 'expo-router';

export default function MyRequestsRedirect() {
  return <Redirect href="/(app)/history?tab=mine" />;
}
