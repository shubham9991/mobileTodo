import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { dummyData } from '../../../core/dummyData';

const FILTER_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  Tomorrow: 'calendar-today',
  '6 PM':   'schedule',
  Work:     'label',
};

export const SearchAndFilter = () => {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {/* Search Bar — compact height */}
      <View style={[styles.searchBar, { backgroundColor: theme.colors.secondary, borderColor: theme.colors.border }]}>
        <MaterialIcons name="search" size={18} color={theme.colors.textSecondary} />
        <TextInput
          placeholder="Search tasks or notes..."
          placeholderTextColor={theme.colors.textSecondary}
          style={[styles.searchInput, { color: theme.colors.text }]}
        />
      </View>

      {/* Quick Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillContent}
      >
        {dummyData.quickFilters.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.pill, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}
          >
            <MaterialIcons
              name={FILTER_ICONS[filter] || 'label'}
              size={12}
              color={theme.colors.textSecondary}
            />
            <Text style={[styles.pillText, { color: theme.colors.textSecondary }]}>{filter}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,   // Compact height
    marginBottom: 8,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,   // Remove extra RN default padding
    height: 20,
  },
  pillContent: {
    gap: 6,
    paddingBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
