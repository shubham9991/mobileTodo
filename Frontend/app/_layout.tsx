import React from 'react';
import { Stack } from "expo-router";
import { ThemeProvider, useTheme } from "../src/themes/ThemeContext";
import { DashboardProvider } from "../src/core/DashboardContext";
import { ManageProvider } from "../src/core/ManageContext";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { View, ActivityIndicator, Platform } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as NavigationBar from 'expo-navigation-bar';


// Inner shell that has access to ThemeContext
function AppShell() {
  const { isDark } = useTheme();

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setPositionAsync('absolute');
      NavigationBar.setBackgroundColorAsync('#00000000');
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('inset-swipe');
    }
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Full-screen note editor — no tab bar, no header */}
        <Stack.Screen
          name="note"
          options={{
            headerShown: false,
            // Slide up from bottom for a native sheet feel
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            gestureDirection: 'vertical',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color="#18181B" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemeProvider>
          <ManageProvider>
            <DashboardProvider>
              <KeyboardProvider>
                <AppShell />
              </KeyboardProvider>
            </DashboardProvider>
          </ManageProvider>
        </ThemeProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
