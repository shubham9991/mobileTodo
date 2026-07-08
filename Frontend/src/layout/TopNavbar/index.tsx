import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useTheme } from '../../themes/ThemeContext';
import { useDashboard } from '../../core/DashboardContext';
import { MarketplaceScreen } from '../../features/marketplace/MarketplaceScreen';
import { GlobalSearchModal } from '../../features/search/GlobalSearchModal';
import { SettingsScreen } from '../../features/settings/SettingsScreen';

// Maps route pathname → display title
const PAGE_TITLES: Record<string, string> = {
  '/':         'Modular',
  '/index':    'Modular',
  '/tasks':    'Tasks',
  '/events':   'Events',
  '/manage':   'Manage',
};

export const TopNavbar = ({ 
  onClose, 
  title: propTitle,
  onPressMenu 
}: { 
  onClose?: () => void;
  title?: string;
  onPressMenu?: () => void;
}) => {
  const { theme } = useTheme();
  const { nodes, activeNodeId } = useDashboard();
  const pathname = usePathname();
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const selectedNode = activeNodeId ? nodes[activeNodeId] : null;

  // Dynamic title — default to active project node name on home, or 'Modular'
  const title = propTitle || (pathname === '/' || pathname === '/index' ? (selectedNode?.name || 'Modular') : (PAGE_TITLES[pathname] || 'Modular'));
  const isHome = pathname === '/' || pathname === '/index';

  return (
    <>
      <View style={[styles.container, {
        backgroundColor: theme.colors.background,
        borderBottomColor: theme.colors.border,
      }]}>
        {/* Logo box only on Home; other pages show back/title */}
        <View style={styles.left}>
          {onClose ? (
            <TouchableOpacity onPress={onClose} style={{ padding: 4, marginLeft: -4, marginRight: 4 }}>
              <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          ) : isHome && (
            <TouchableOpacity onPress={onPressMenu} style={[styles.logoBox, { backgroundColor: theme.colors.text }]}>
              <MaterialIcons name="apps" size={16} color={theme.colors.background} />
            </TouchableOpacity>
          )}
          <Text style={[
            styles.appName,
            { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' },
            (!isHome || !!selectedNode) && styles.pageTitle,
          ]}>
            {title}
          </Text>
        </View>

        {/* Right Icons */}
        <View style={styles.right}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowMarketplace(true)}>
            <MaterialIcons name="shopping-bag" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(true)}>
            <MaterialIcons name="search" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSettings(true)}>
            <MaterialIcons name="settings" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Marketplace Modal */}
      <Modal
        visible={showMarketplace}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowMarketplace(false)}
        statusBarTranslucent
      >
        <MarketplaceScreen onClose={() => setShowMarketplace(false)} />
      </Modal>

      {/* Global Search Modal */}
      <GlobalSearchModal visible={showSearch} onClose={() => setShowSearch(false)} />

      {/* Settings Modal — full screen slide up */}
      <Modal
        visible={showSettings}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowSettings(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, position: 'relative' }}>
          <SettingsScreen onClose={() => setShowSettings(false)} />
        </View>
      </Modal>
    </>
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
  closeBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 10,
  },
});
