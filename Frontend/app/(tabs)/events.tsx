// Events tab now redirects to the unified Master Calendar
import { Redirect } from 'expo-router';
export default function EventsRoute() {
  return <Redirect href="/(tabs)/calendar" />;
}
