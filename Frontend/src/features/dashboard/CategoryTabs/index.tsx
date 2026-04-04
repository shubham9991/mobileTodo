import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';

type TabItem = {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
};

const TABS: TabItem[] = [
  { label: 'All',   icon: 'grid-view' },
  { label: 'Tasks', icon: 'task-alt' },
  { label: 'Notes', icon: 'description' },
];

export const CategoryTabs = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('All');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.secondary }]}>
      {TABS.map((tab) => {
        const isActive = tab.label === activeTab;
        return (
          <TouchableOpacity
            key={tab.label}
            style={[
              styles.tab,
              isActive && [styles.activeTab, {
                backgroundColor: theme.colors.cardPrimary,
                shadowColor: theme.colors.text,
              }],
            ]}
            onPress={() => setActiveTab(tab.label)}
          >
            <MaterialIcons
              name={tab.icon}
              size={15}
              color={isActive ? theme.colors.text : theme.colors.textSecondary}
            />
            <Text style={[
              styles.tabText,
              { color: isActive ? theme.colors.text : theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }
            ]}>
              {tab.label}
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
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 8,
    padding: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 5,
  },
  activeTab: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
