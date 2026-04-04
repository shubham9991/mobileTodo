import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Pressable, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';

type FilterTab = 'All' | 'Active' | 'Completed';
type SortDirection = 'asc' | 'desc';

const FILTER_TABS: FilterTab[] = ['All', 'Active', 'Completed'];

const SORT_OPTIONS = [
  { key: 'Due Date',     icon: 'schedule' as const,     label: 'Due Date'     },
  { key: 'Priority',     icon: 'flag' as const,          label: 'Priority'     },
  { key: 'Alphabetical', icon: 'sort-by-alpha' as const, label: 'Alphabetical' },
  { key: 'Created',      icon: 'add-circle-outline' as const, label: 'Date Created' },
];

interface Props {
  activeFilter: FilterTab;
  onFilterChange: (f: FilterTab) => void;
  activeSort: string;
  onSortChange: (s: string) => void;
}

export const TaskFilter = ({ activeFilter, onFilterChange, activeSort, onSortChange }: Props) => {
  const { theme } = useTheme();
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const currentSortOption = SORT_OPTIONS.find((s) => s.key === activeSort) || SORT_OPTIONS[0];

  return (
    <>
      <View style={styles.container}>
        {/* Filter Tabs */}
        <View style={[styles.tabsRow, { backgroundColor: theme.colors.secondary }]}>
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  isActive && [styles.activeTab, {
                    backgroundColor: theme.colors.cardPrimary,
                    shadowColor: theme.colors.text,
                  }],
                ]}
                onPress={() => onFilterChange(tab)}
              >
                <Text style={[
                  styles.tabText,
                  { color: isActive ? theme.colors.text : theme.colors.textSecondary, fontFamily: 'Inter_500Medium' },
                ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sort Row — single polished button */}
        <View style={styles.sortRow}>
          <Text style={[styles.sortLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            Sorted by
          </Text>
          <TouchableOpacity
            style={[styles.sortButton, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}
            onPress={() => setShowSortModal(true)}
          >
            <MaterialIcons name={currentSortOption.icon} size={13} color={theme.colors.text} />
            <Text style={[styles.sortButtonText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
              {currentSortOption.label}
            </Text>
            <View style={[styles.dirBadge, { backgroundColor: theme.colors.secondary }]}>
              <MaterialIcons
                name={sortDir === 'asc' ? 'arrow-upward' : 'arrow-downward'}
                size={10}
                color={theme.colors.textSecondary}
              />
            </View>
            <MaterialIcons name="keyboard-arrow-down" size={15} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Bottom Sheet Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowSortModal(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.colors.cardPrimary }]}
            onPress={() => {}}
          >
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

            {/* Title + Direction Toggle */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
                Sort Tasks
              </Text>
              <TouchableOpacity
                style={[styles.dirToggle, {
                  backgroundColor: theme.colors.secondary,
                  borderColor: theme.colors.border,
                }]}
                onPress={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
              >
                <MaterialIcons
                  name={sortDir === 'asc' ? 'arrow-upward' : 'arrow-downward'}
                  size={14}
                  color={theme.colors.text}
                />
                <Text style={[styles.dirToggleText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                  {sortDir === 'asc' ? 'Ascending' : 'Descending'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            {/* Options */}
            {SORT_OPTIONS.map((option) => {
              const isSelected = activeSort === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.sortOption,
                    isSelected && { backgroundColor: theme.colors.secondary },
                  ]}
                  onPress={() => {
                    onSortChange(option.key);
                    setShowSortModal(false);
                  }}
                >
                  <View style={[styles.optionIconWrap, {
                    backgroundColor: isSelected ? theme.colors.primary : theme.colors.secondary,
                  }]}>
                    <MaterialIcons
                      name={option.icon}
                      size={16}
                      color={isSelected ? theme.colors.primaryText : theme.colors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.optionLabel, {
                    color: theme.colors.text,
                    fontFamily: isSelected ? 'Inter_600SemiBold' : 'Inter_400Regular',
                  }]}>
                    {option.label}
                  </Text>
                  {isSelected && (
                    <MaterialIcons name="check" size={16} color={theme.colors.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Done button */}
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => setShowSortModal(false)}
            >
              <Text style={[styles.doneBtnText, { color: theme.colors.primaryText, fontFamily: 'Inter_600SemiBold' }]}>
                Apply
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: { fontSize: 13 },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sortLabel: { fontSize: 12 },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortButtonText: { fontSize: 13 },
  dirBadge: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Bottom Sheet ───────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 18 },
  dirToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  dirToggleText: { fontSize: 13 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  optionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: { fontSize: 15 },
  doneBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 15 },
});
