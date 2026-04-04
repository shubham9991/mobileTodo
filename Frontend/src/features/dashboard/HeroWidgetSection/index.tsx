import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { dummyData } from '../../../core/dummyData';
import { Skeleton } from '../../../core/components/Skeleton';

export const HeroWidgetSection = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);

  // Simulate a brief data load (replace with real fetch later)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <View style={[styles.outerCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
        <Skeleton width={120} height={11} style={{ marginBottom: 8 }} />
        <Skeleton width={160} height={26} style={{ marginBottom: 14 }} />
        <View style={[styles.innerCard, { backgroundColor: theme.colors.secondary }]}>
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton width={100} height={10} />
            <Skeleton width={130} height={17} />
            <Skeleton width={90} height={12} />
          </View>
          <Skeleton width={90} height={36} borderRadius={8} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.outerCard, {
      backgroundColor: theme.colors.cardPrimary,
      borderColor: theme.colors.border,
    }]}>
      {/* Today's Focus Header */}
      <View style={styles.focusHeader}>
        <MaterialIcons name="bolt" size={14} color={theme.colors.textSecondary} />
        <Text style={[styles.focusLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
          TODAY'S FOCUS
        </Text>
      </View>

      <Text style={[styles.focusTitle, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
        {dummyData.user.todaysFocusCount} tasks left
      </Text>

      {/* Inner dark task card */}
      <View style={[styles.innerCard, { backgroundColor: theme.colors.heroCardBg }]}>

        {/* ── Decorative circles (faint, absolute positioned) ── */}
        <View style={[styles.decCircleLarge, { borderColor: 'rgba(255,255,255,0.06)' }]} />
        <View style={[styles.decCircleSmall, { borderColor: 'rgba(255,255,255,0.08)' }]} />

        <View style={styles.innerCardContent}>
          <Text style={[styles.innerLabel, { color: 'rgba(250,250,250,0.5)', fontFamily: 'Inter_500Medium' }]}>
            {dummyData.heroWidget.label}
          </Text>
          <Text style={[styles.innerTitle, { color: theme.colors.heroCardText, fontFamily: 'Inter_600SemiBold' }]}>
            {dummyData.heroWidget.title}
          </Text>
          <Text style={[styles.innerSubtitle, { color: 'rgba(250,250,250,0.55)', fontFamily: 'Inter_400Regular' }]}>
            {dummyData.heroWidget.subtitle}
          </Text>
        </View>

        <TouchableOpacity style={[styles.focusBtn, { backgroundColor: theme.colors.cardPrimary }]}>
          <Text style={[styles.focusBtnText, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
            Start Focus
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  focusLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  focusTitle: {
    fontSize: 22,
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  innerCard: {
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',   // Clips the decorative circles
    position: 'relative',
  },

  // ── Decorative arc elements ──────────────────────────────
  decCircleLarge: {
    position: 'absolute',
    right: -30,
    top: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 28,
  },
  decCircleSmall: {
    position: 'absolute',
    right: 40,
    bottom: -35,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 18,
  },

  innerCardContent: {
    flex: 1,
    zIndex: 1,
  },
  innerLabel: {
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  innerTitle: {
    fontSize: 17,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  innerSubtitle: {
    fontSize: 12,
  },
  focusBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    marginLeft: 12,
    zIndex: 1,
  },
  focusBtnText: {
    fontSize: 13,
  },
});
