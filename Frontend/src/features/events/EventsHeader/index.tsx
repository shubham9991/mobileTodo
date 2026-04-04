import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';

export const EventsHeader = () => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.title, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
        Events
      </Text>
      <TouchableOpacity style={[styles.newBtn, { backgroundColor: theme.colors.primary }]}>
        <MaterialIcons name="add" size={16} color={theme.colors.primaryText} />
        <Text style={[styles.newBtnText, { color: theme.colors.primaryText, fontFamily: 'Inter_600SemiBold' }]}>
          New Event
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newBtnText: { fontSize: 13 },
});
