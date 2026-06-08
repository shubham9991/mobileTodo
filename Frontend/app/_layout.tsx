// Silence developer tools promise rejection errors during hot reload (e.g. keep-awake / navigation-bar)
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const errorStr = args.map(a => {
      if (a instanceof Error) {
        return a.message + '\n' + a.stack;
      }
      if (typeof a === 'object' && a !== null) {
        try {
          return a.message || JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    }).join(' ');

    if (
      errorStr.includes('Unable to activate keep awake') ||
      errorStr.includes('setButtonStyleAsync') ||
      errorStr.includes('The current activity is no longer available')
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

import React from 'react';
import { Stack } from "expo-router";
import { ThemeProvider, useTheme } from "../src/themes/ThemeContext";
import { DashboardProvider } from "../src/core/DashboardContext";
import { ManageProvider } from "../src/core/ManageContext";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import { View, ActivityIndicator, Platform } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as NavigationBar from 'expo-navigation-bar';
import { loadAllDownloadedFonts } from '../src/features/notes/fontManager';


// Inner shell that has access to ThemeContext
function AppShell() {
  const { isDark } = useTheme();

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});
    }
  }, [isDark]);

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
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular: require('../assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('../assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('../assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('../assets/fonts/Inter_700Bold.ttf'),
  });

  React.useEffect(() => {
    loadAllDownloadedFonts();
  }, []);

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
