import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../themes/ThemeContext';

type NavItem = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  route: string;
  match: string; // pathname segment to match for active state
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Home',     icon: 'home',           route: '/(tabs)/',        match: '/'        },
  { label: 'Tasks',    icon: 'checklist',       route: '/(tabs)/tasks',   match: '/tasks'   },
  { label: 'Events',   icon: 'calendar-month',  route: '/(tabs)/events',  match: '/events'  },
  { label: 'Manage',   icon: 'tune',            route: '/(tabs)/manage',  match: '/manage'  },
];

export const BottomNavbar = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets(); // ← dynamically accounts for 3-button nav / gesture nav / nothing

  return (
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.border,
      paddingBottom: Math.max(insets.bottom, 8), // respects nav bar height on any device
    }]}>
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.match === '/'
            ? pathname === '/' || pathname === '/index'
            : pathname.startsWith(item.match);

        return (
          <TouchableOpacity
            key={item.label}
            style={styles.navItem}
            onPress={() => router.push(item.route as any)}
          >
            <MaterialIcons
              name={item.icon}
              size={24}
              color={isActive ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={[styles.label, {
              color: isActive ? theme.colors.primary : theme.colors.textSecondary,
              fontFamily: 'Inter_500Medium',
            }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    // paddingBottom is set dynamically via insets.bottom above
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
  },
});
