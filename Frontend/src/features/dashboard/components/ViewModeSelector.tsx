import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { useDashboard } from '../../../core/DashboardContext';
import { DashboardViewMode } from '../dashboardPrefsStore';

interface ViewModeOption {
  id: DashboardViewMode;
  label: string;
  shortLabel: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

const VIEW_MODES: ViewModeOption[] = [
  { id: 'bento', label: 'Bento Hub', shortLabel: 'Bento', icon: 'view-quilt' },
  { id: 'focus', label: 'Focus Stream', shortLabel: 'Focus', icon: 'bolt' },
  { id: 'studio', label: 'Creative Studio', shortLabel: 'Studio', icon: 'palette' },
  { id: 'minimal', label: 'Minimalist', shortLabel: 'Minimal', icon: 'crop-free' },
];

interface ViewModeSelectorProps {
  compact?: boolean;
  onOpenSettings?: () => void;
}

export const ViewModeSelector = ({ compact = false, onOpenSettings }: ViewModeSelectorProps) => {
  const { theme } = useTheme();
  const { activeViewMode, setActiveViewMode } = useDashboard();

  const handleSelect = (mode: DashboardViewMode) => {
    if (mode === activeViewMode) return;
    Haptics.selectionAsync().catch(() => {});
    setActiveViewMode(mode);
  };

  return (
    <View style={[styles.container, { borderBottomColor: theme.colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.pillBar, { backgroundColor: theme.colors.secondary }]}>
          {VIEW_MODES.map((item) => {
            const isSelected = activeViewMode === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleSelect(item.id)}
                activeOpacity={0.7}
                style={[
                  styles.tabButton,
                  isSelected && [
                    styles.tabButtonActive,
                    { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border },
                  ],
                ]}
              >
                <MaterialIcons
                  name={item.icon}
                  size={15}
                  color={isSelected ? theme.colors.text : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isSelected ? theme.colors.text : theme.colors.textSecondary,
                      fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_500Medium',
                    },
                  ]}
                >
                  {compact ? item.shortLabel : item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {onOpenSettings && (
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}
            onPress={onOpenSettings}
            activeOpacity={0.7}
          >
            <MaterialIcons name="tune" size={15} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 24,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  tabButtonActive: {
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  settingsButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
