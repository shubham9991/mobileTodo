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

import React, { useRef, useEffect, useState } from 'react';
import { Stack } from "expo-router";
import { ThemeProvider, useTheme } from "../src/themes/ThemeContext";
import { DashboardProvider, useDashboard } from "../src/core/DashboardContext";
import { ManageProvider, useManage } from "../src/core/ManageContext";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useFonts } from 'expo-font';
import { View, Text, ActivityIndicator, Platform, Animated, Easing, Vibration, StyleSheet, TouchableOpacity, PanResponder, Dimensions } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as NavigationBar from 'expo-navigation-bar';
import { loadAllDownloadedFonts } from '../src/features/notes/fontManager';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import notifee, { EventType, TriggerType } from '@notifee/react-native';
import { createAudioPlayer, AudioPlayer } from 'expo-audio';

// ─── Incoming Reminder Overlay (Premium Alarm Style) ──────────────────────────────────────────────────────────────────────────────────────
const SNOOZE_OPTIONS = [
  { label: '5 min',  minutes: 5  },
  { label: '10 min', minutes: 10 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
];

const IncomingReminderOverlay = ({
  reminder,
  onClose,
}: {
  reminder: { id: string; title: string };
  onClose: () => void;
}) => {
  const { theme } = useTheme();
  const { updateTask } = useDashboard();
  const { alarmTone } = useManage();
  const [alarmPlayer, setAlarmPlayer] = useState<AudioPlayer | null>(null);
  const [snoozeMinutes, setSnoozeMinutes] = useState(15);
  const overlayFade = useRef(new Animated.Value(0)).current;

  // ── Startup & Sound Playback ──
  useEffect(() => {
    Animated.timing(overlayFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Vibration.vibrate([0, 800, 500, 800], true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    let activePlayer: AudioPlayer | null = null;
    const playAlarmSound = async () => {
      if (alarmTone === 'silent') return;
      try {
        let soundAsset;
        if (alarmTone === 'gentle') {
          soundAsset = require('../assets/sounds/chimes.mp3');
        } else if (alarmTone === 'classic') {
          soundAsset = require('../assets/sounds/constant_beep.mp3');
        } else if (alarmTone === 'bell') {
          soundAsset = require('../assets/sounds/bell.mp3');
        } else if (alarmTone === 'default') {
          soundAsset = require('../assets/sounds/chimes.mp3');
        } else {
          soundAsset = { uri: alarmTone };
        }

        const player = createAudioPlayer(soundAsset);
        player.loop = true;
        player.play();

        activePlayer = player;
        setAlarmPlayer(player);
      } catch (err) {
        console.warn('Failed to load/play alarm sound:', err);
      }
    };

    playAlarmSound();

    return () => {
      Vibration.cancel();
      if (activePlayer) {
        activePlayer.pause();
        activePlayer.release();
      }
    };
  }, [alarmTone]);

  // ── Handlers ──
  const handleComplete = () => {
    Vibration.cancel();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateTask(reminder.id, t => ({ ...t, completed: true }));
    onClose();
  };

  const handleDismiss = () => {
    Vibration.cancel();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  const handleSnooze = async () => {
    Vibration.cancel();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const channelId = await notifee.createChannel({
      id: 'task-reminders',
      name: 'Task Reminders',
      importance: 4,
      vibration: true,
    });
    await notifee.createTriggerNotification(
      {
        id: `${reminder.id}_snooze_${Date.now()}`,
        title: 'Reminder (Snoozed)',
        body: reminder.title,
        android: {
          channelId,
          category: 'alarm',
          importance: 4,
          fullScreenAction: { id: 'default' },
          pressAction: { id: 'default' },
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: Date.now() + snoozeMinutes * 60 * 1000 }
    );
    onClose();
  };

  // ── Parse task items to show colored pill tags ──
  const items = reminder.title
    .split(/,|\band\b/i)
    .map(s => s.trim())
    .filter(Boolean);

  const getPillColor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('calcium')) return '#FFFFFF';
    if (n.includes('iron')) return '#F97316';
    if (n.includes('vitamin d') || n.includes('vitamin-d') || n.includes('vit d')) return '#EAB308';
    if (n.includes('water') || n.includes('drink')) return '#3B82F6';
    return '#A855F7'; // default pill accent
  };

  const formattedTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, oStyles.root, { opacity: overlayFade }]}>
      {/* Dynamic/Fluid Green Gradient Circles */}
      <View style={oStyles.gradientBackground}>
        <View style={oStyles.bubbleTop} />
        <View style={oStyles.bubbleBottom} />
      </View>

      {/* Main Content Area */}
      <View style={oStyles.contentContainer}>
        {/* Title indicating time */}
        <Text style={[oStyles.timeHeader, { fontFamily: 'Inter_500Medium' }]}>
          Time for your {formattedTime} reminder
        </Text>

        {/* List of items */}
        <View style={oStyles.itemsList}>
          {items.map((item, idx) => (
            <View key={idx} style={oStyles.itemRow}>
              {/* Medicine/Pill Shape Icon */}
              <View style={[oStyles.pillShape, { backgroundColor: getPillColor(item) }]} />
              <Text style={[oStyles.itemName, { fontFamily: 'Inter_600SemiBold' }]}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Actions: Take & Dismiss Buttons */}
      <View style={oStyles.actionsContainer}>
        <TouchableOpacity
          style={oStyles.dismissBtn}
          onPress={handleDismiss}
          activeOpacity={0.8}
        >
          <Text style={[oStyles.dismissBtnText, { fontFamily: 'Inter_600SemiBold' }]}>
            Dismiss
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={oStyles.takeBtn}
          onPress={handleComplete}
          activeOpacity={0.8}
        >
          <Text style={[oStyles.takeBtnText, { fontFamily: 'Inter_600SemiBold' }]}>
            Take
          </Text>
        </TouchableOpacity>
      </View>

      {/* Interactive Snooze controls with increment/decrement steppers */}
      <View style={oStyles.snoozeContainer}>
        {/* Decrement Button */}
        <TouchableOpacity
          style={oStyles.stepperBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSnoozeMinutes(m => Math.max(5, m - 5));
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="remove" size={24} color="#A7F3D0" />
        </TouchableOpacity>

        {/* Center Snooze Action Capsule */}
        <TouchableOpacity
          style={oStyles.snoozeCapsule}
          onPress={handleSnooze}
          activeOpacity={0.8}
        >
          <Text style={[oStyles.snoozeText, { fontFamily: 'Inter_600SemiBold' }]}>
            Snooze {snoozeMinutes} mins
          </Text>
        </TouchableOpacity>

        {/* Increment Button */}
        <TouchableOpacity
          style={oStyles.stepperBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSnoozeMinutes(m => Math.min(120, m + 5));
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="add" size={24} color="#A7F3D0" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const oStyles = StyleSheet.create({
  root: {
    zIndex: 99999,
    backgroundColor: '#051C12', // Deep forest green background
    justifyContent: 'space-between',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#051C12',
    overflow: 'hidden',
  },
  bubbleTop: {
    position: 'absolute',
    top: '-20%',
    right: '-10%',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#0C4B2E',
    opacity: 0.7,
  },
  bubbleBottom: {
    position: 'absolute',
    bottom: '-10%',
    left: '-15%',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: '#105C3A',
    opacity: 0.6,
  },
  contentContainer: {
    flex: 1,
    marginTop: 64,
  },
  timeHeader: {
    fontSize: 24,
    color: '#E2E8F0',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 32,
  },
  itemsList: {
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 24,
    gap: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  pillShape: {
    width: 48,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  itemName: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  dismissBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: '#E2E8F0',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  takeBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00C853', // Samsung Health Take Button bright green
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  takeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  snoozeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  snoozeCapsule: {
    flex: 1,
    marginHorizontal: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  snoozeText: {
    color: '#E2E8F0',
    fontSize: 15,
  },
});




// Inner shell that has access to ThemeContext
function AppShell() {
  const { isDark } = useTheme();
  const { isDockExpanded, setIsDockExpanded } = useManage();
  const [activeReminder, setActiveReminder] = useState<{ id: string; title: string } | null>(null);

  const screenH = Dimensions.get('window').height;

  const handleGlobalTouch = (e: any) => {
    if (isDockExpanded) {
      const touchY = e.nativeEvent.pageY;
      // Close the dock if the user interacts with the screen above the dock area
      if (touchY < screenH - 210) {
        setIsDockExpanded(false);
      }
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark').catch(() => {});
    }
  }, [isDark]);

  useEffect(() => {
    // 1. Check initial notification (e.g. if app was launched by notification from quit state)
    notifee.getInitialNotification().then(initial => {
      if (initial) {
        const id = initial.notification.id;
        const title = initial.notification.body;
        if (id && title) {
          setActiveReminder({ id, title });
        }
      }
    });

    // 2. Listen to foreground events
    const unsubscribeForeground = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        const id = detail.notification?.id;
        const title = detail.notification?.body;
        if (id && title) {
          setActiveReminder({ id, title });
        }
      } else if (type === EventType.DELIVERED) {
        // Automatically open full screen overlay if app is in foreground when alert fires!
        const id = detail.notification?.id;
        const title = detail.notification?.body;
        if (id && title) {
          setActiveReminder({ id, title });
        }
      }
    });

    return () => {
      unsubscribeForeground();
    };
  }, []);

  return (
    <View style={{ flex: 1 }} onTouchStart={handleGlobalTouch}>
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
        {/* Full-screen drawing canvas — no tab bar, no header */}
        <Stack.Screen
          name="drawing"
          options={{
            headerShown: false,
            animation: 'slide_from_bottom',
            gestureEnabled: true,
            gestureDirection: 'vertical',
          }}
        />
      </Stack>

      {activeReminder && (
        <IncomingReminderOverlay
          reminder={activeReminder}
          onClose={() => setActiveReminder(null)}
        />
      )}
    </View>
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
