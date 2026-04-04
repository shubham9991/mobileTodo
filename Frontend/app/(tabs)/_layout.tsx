import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // Hide the default Expo tab bar — we render our own BottomNavbar inside each screen
      tabBar={() => null}
    />
  );
}
