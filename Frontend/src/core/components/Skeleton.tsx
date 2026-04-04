import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../themes/ThemeContext';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export const Skeleton = ({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) => {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 800 }),
        withTiming(0.4, { duration: 800 })
      ),
      -1
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.colors.border,
        },
        animStyle,
        style,
      ]}
    />
  );
};

// ── Task card skeleton ─────────────────────────────────────────────────────
export const TaskCardSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.cardPrimary }]}>
      <View style={styles.row}>
        <Skeleton width={18} height={18} borderRadius={9} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={14} />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Skeleton width={50} height={20} borderRadius={4} />
            <Skeleton width={30} height={20} borderRadius={4} />
          </View>
        </View>
      </View>
    </View>
  );
};

// ── Note card skeleton ─────────────────────────────────────────────────────
export const NoteCardSkeleton = () => {
  const { theme } = useTheme();
  return (
    <View style={[styles.noteCard, { borderColor: theme.colors.border, backgroundColor: theme.colors.cardPrimary }]}>
      <Skeleton width="80%" height={13} style={{ marginBottom: 8 }} />
      <Skeleton width="100%" height={11} style={{ marginBottom: 4 }} />
      <Skeleton width="60%" height={11} style={{ marginBottom: 12 }} />
      <Skeleton width="35%" height={11} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8, borderWidth: 1, padding: 12, marginBottom: 6,
  },
  row: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  noteCard: {
    flex: 1, borderRadius: 8, borderWidth: 1, padding: 12, minHeight: 110,
  },
});
