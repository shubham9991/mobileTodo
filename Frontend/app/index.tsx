import { Redirect } from 'expo-router';

// Redirect root "/" to the tabs group's home screen
export default function Root() {
  return <Redirect href="/(tabs)/" />;
}
