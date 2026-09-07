import { Redirect, useLocalSearchParams } from 'expo-router';

export default function RequestsRedirect() {
  const params = useLocalSearchParams();
  const requestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;

  if (requestId) {
    return <Redirect href={`/(app)/request/${requestId}`} />;
  }

  return <Redirect href="/(app)/history?tab=incoming" />;
}
