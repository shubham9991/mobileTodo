import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../themes/ThemeContext';
import { useManage } from '../../core/ManageContext';

type NavItem = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  route: string;
  match: string;
};

const BASE_NAV_ITEMS: NavItem[] = [
  { label: 'Home',     icon: 'home',           route: '/(tabs)/',        match: '/'        },
  { label: 'Tasks',    icon: 'checklist',       route: '/(tabs)/tasks',   match: '/tasks'   },
  { label: 'Events',   icon: 'calendar-month',  route: '/(tabs)/events',  match: '/events'  },
  { label: 'Manage',   icon: 'tune',            route: '/(tabs)/manage',  match: '/manage'  },
];

const CALENDAR_NAV_ITEM: NavItem = {
  label: 'Calendar',
  icon: 'date-range',
  route: '/(tabs)/calendar',
  match: '/calendar',
};

export const BottomNavbar = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { showCalendarInDock } = useManage();

  // Inject the Calendar tab between Events and Manage when enabled
  const navItems = showCalendarInDock
    ? [
        BASE_NAV_ITEMS[0],
        BASE_NAV_ITEMS[1],
        BASE_NAV_ITEMS[2],
        CALENDAR_NAV_ITEM,
        BASE_NAV_ITEMS[3],
      ]
    : BASE_NAV_ITEMS;

  return (
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.border,
      paddingBottom: Math.max(insets.bottom, 8),
    }]}>
      {navItems.map((item) => {
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
