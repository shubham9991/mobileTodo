import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import {
  getAllDrawings,
  formatDrawingTime,
  generateDrawingId,
  type DrawingMeta,
} from '../../drawing/drawingStore';
import { Skeleton } from '../../../core/components/Skeleton';

interface RecentSketchesWidgetProps {
  maxItems?: number;
  compact?: boolean;
}

export const RecentSketchesWidget = ({ maxItems = 2, compact = false }: RecentSketchesWidgetProps) => {
  const { theme } = useTheme();
  const router = useRouter();
  const [sketches, setSketches] = useState<DrawingMeta[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDrawings = useCallback(async () => {
    try {
      const all = await getAllDrawings();
      setSketches(all.slice(0, maxItems));
    } catch {
      setSketches([]);
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useFocusEffect(
    useCallback(() => {
      loadDrawings();
    }, [loadDrawings])
  );

  const handleOpenDrawing = useCallback((d: DrawingMeta) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({
      pathname: '/drawing',
      params: { drawingId: d.id, drawingTitle: d.title },
    });
  }, [router]);

  const handleCreateNew = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const id = generateDrawingId();
    router.push({
      pathname: '/drawing',
      params: { drawingId: id, drawingTitle: 'Untitled Sketch' },
    });
  }, [router]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialIcons name="brush" size={13} color={theme.colors.textSecondary} />
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
            RECENT SKETCHES
          </Text>
        </View>
        <TouchableOpacity onPress={handleCreateNew} style={styles.addBtn} activeOpacity={0.7}>
          <MaterialIcons name="add" size={16} color={theme.colors.primary} />
          <Text style={[styles.addText, { color: theme.colors.primary, fontFamily: 'Inter_600SemiBold' }]}>
            New Sketch
          </Text>
        </TouchableOpacity>
      </View>

      {/* Grid or Cards */}
      <View style={styles.grid}>
        {loading ? (
          <>
            <Skeleton width="48%" height={compact ? 80 : 110} borderRadius={8} />
            <Skeleton width="48%" height={compact ? 80 : 110} borderRadius={8} />
          </>
        ) : sketches.length === 0 ? (
          <TouchableOpacity
            style={[
              styles.emptyCard,
              {
                borderColor: theme.colors.border,
                borderStyle: 'dashed',
                backgroundColor: theme.colors.cardPrimary,
              },
            ]}
            onPress={handleCreateNew}
            activeOpacity={0.7}
          >
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.secondary }]}>
              <MaterialIcons name="gesture" size={22} color={theme.colors.primary} />
            </View>
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              No sketches yet • Tap to draw
            </Text>
          </TouchableOpacity>
        ) : (
          sketches.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.cardPrimary,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => handleOpenDrawing(item)}
              activeOpacity={0.7}
            >
              {item.thumbnailUri ? (
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: item.thumbnailUri }} style={styles.thumbnail} resizeMode="cover" />
                </View>
              ) : (
                <View style={[styles.placeholderThumb, { backgroundColor: theme.colors.secondary }]}>
                  <MaterialIcons name="draw" size={24} color={theme.colors.textSecondary} />
                </View>
              )}

              <View style={styles.cardInfo}>
                <Text
                  style={[styles.cardTitle, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}
                  numberOfLines={1}
                >
                  {item.title || 'Untitled Sketch'}
                </Text>
                <View style={styles.metaRow}>
                  <MaterialIcons name="schedule" size={11} color={theme.colors.textSecondary} />
                  <Text style={[styles.timeText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                    {formatDrawingTime(item.updatedAt)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  addText: {
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 90,
  },
  emptyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
  },
  card: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbWrap: {
    height: 64,
    width: '100%',
    backgroundColor: '#1E1E1E',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumb: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    padding: 8,
  },
  cardTitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
  },
});
