import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';

// ── Section Header ──────────────────────────────────────────────────────────
interface SectionHeaderProps { label: string; }
export const SectionHeader = ({ label }: SectionHeaderProps) => {
  const { theme } = useTheme();
  return (
    <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
      {label}
    </Text>
  );
};

// ── Settings Row ────────────────────────────────────────────────────────────
interface SettingRowProps {
  icon: string;
  iconBg?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
  danger?: boolean;
}
export const SettingRow = ({ icon, iconBg, label, value, onPress, isLast, danger }: SettingRowProps) => {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.row,
        { borderBottomColor: theme.colors.border },
        !isLast && styles.rowBorder,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg || theme.colors.secondary }]}>
        <MaterialIcons
          name={icon as any}
          size={16}
          color={danger ? '#EF4444' : theme.colors.text}
        />
      </View>
      <Text style={[
        styles.rowLabel,
        { color: danger ? '#EF4444' : theme.colors.text, fontFamily: 'Inter_500Medium' },
      ]}>
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {value}
          </Text>
        ) : null}
        {onPress && !danger && (
          <MaterialIcons name="chevron-right" size={18} color={theme.colors.border} />
        )}
      </View>
    </TouchableOpacity>
  );
};

// ── Toggle Row ──────────────────────────────────────────────────────────────
interface ToggleRowProps {
  icon: string;
  iconBg?: string;
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isLast?: boolean;
}
export const ToggleRow = ({ icon, iconBg, label, subtitle, value, onChange, isLast }: ToggleRowProps) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }, !isLast && styles.rowBorder]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg || theme.colors.secondary }]}>
        <MaterialIcons name={icon as any} size={16} color={theme.colors.text} />
      </View>
      <View style={styles.toggleLabelWrap}>
        <Text style={[styles.rowLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
          {label}
        </Text>
        {subtitle ? (
          <Text style={[styles.toggleSubtitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#E4E4E7', true: '#18181B' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
};

// ── Card Container ──────────────────────────────────────────────────────────
interface CardProps { children: React.ReactNode; }
export const SettingsCard = ({ children }: CardProps) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 11,
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 6,
    marginTop: 20,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    fontSize: 13,
  },
  toggleLabelWrap: {
    flex: 1,
  },
  toggleSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
});
