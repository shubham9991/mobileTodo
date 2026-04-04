import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useTheme } from '../../themes/ThemeContext';

// Maps route pathname → display title
const PAGE_TITLES: Record<string, string> = {
  '/':         'Modular',
  '/index':    'Modular',
  '/tasks':    'Tasks',
  '/events':   'Events',
  '/settings': 'Settings',
};

export const TopNavbar = () => {
  const { theme } = useTheme();
  const pathname = usePathname();

  // Dynamic title — default to 'Modular' for unknown routes
  const title = PAGE_TITLES[pathname] ?? 'Modular';
  const isHome = title === 'Modular';

  return (
    <View style={[styles.container, {
      backgroundColor: theme.colors.background,
      borderBottomColor: theme.colors.border,
    }]}>
      {/* Logo box only on Home; other pages show back/title */}
      <View style={styles.left}>
        {isHome && (
          <View style={[styles.logoBox, { backgroundColor: theme.colors.text }]}>
            <MaterialIcons name="dashboard" size={14} color={theme.colors.background} />
          </View>
        )}
        <Text style={[
          styles.appName,
          { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' },
          !isHome && styles.pageTitle,
        ]}>
          {title}
        </Text>
      </View>

      {/* Right Icons */}
      <View style={styles.right}>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="shopping-bag" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="notifications-none" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <MaterialIcons name="settings" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  pageTitle: {
    fontSize: 20,
    letterSpacing: -0.4,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 6,
    marginLeft: 2,
  },
});
