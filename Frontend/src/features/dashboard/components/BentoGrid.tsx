import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';
import { Task } from '../../../core/dummyData';
import { Note, formatRelativeTime } from '../../../core/db/notesStore';
import { DrawingMeta, formatDrawingTime } from '../../drawing/drawingStore';

import { DisplayDensity } from '../dashboardPrefsStore';

interface BentoGridProps {
  tasks: Task[];
  onToggleTask: (id: string) => void;
  onPressNewTask: () => void;
  note: Note | null;
  onOpenNote: (note: Note) => void;
  onCreateNote: () => void;
  sketch: DrawingMeta | null;
  onOpenSketch: (sketch: DrawingMeta) => void;
  onCreateSketch: () => void;
  density?: DisplayDensity;
}

export const BentoGrid = ({
  tasks,
  onToggleTask,
  onPressNewTask,
  note,
  onOpenNote,
  onCreateNote,
  sketch,
  onOpenSketch,
  onCreateSketch,
  density = 'comfortable',
}: BentoGridProps) => {
  const { theme } = useTheme();
  const isCompact = density === 'compact';
  const isExpanded = density === 'expanded';
  const tileMinHeight = isCompact ? 125 : isExpanded ? 165 : 145;
  const taskCount = isCompact ? 2 : isExpanded ? 4 : 3;

  return (
    <View style={styles.gridContainer}>
      {/* ── ROW 1: Tile A (Tasks) & Tile B (Note) ── */}
      <View style={styles.row}>
        {/* Tile A: Today's Tasks Checklist */}
        <View style={[styles.tile, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border, minHeight: tileMinHeight }]}>
          <View style={styles.tileHeader}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="check-circle-outline" size={14} color="#10B981" />
              <Text style={[styles.tileTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                TASKS
              </Text>
            </View>
            <TouchableOpacity onPress={onPressNewTask} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="add" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tileBody}>
            {tasks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="done-all" size={20} color={theme.colors.textSecondary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  All done for today!
                </Text>
              </View>
            ) : (
              tasks.slice(0, taskCount).map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.taskItemRow}
                  onPress={() => onToggleTask(t.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.miniCheckbox,
                      { borderColor: t.completed ? theme.colors.primary : theme.colors.border },
                      t.completed && { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    {t.completed && (
                      <MaterialIcons name="check" size={10} color={theme.colors.primaryText} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.taskItemText,
                      {
                        color: t.completed ? theme.colors.textSecondary : theme.colors.text,
                        textDecorationLine: t.completed ? 'line-through' : 'none',
                        fontFamily: 'Inter_400Regular',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {t.title}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* Tile B: Latest Note Preview */}
        <TouchableOpacity
          style={[styles.tile, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border, minHeight: tileMinHeight }]}
          onPress={() => (note ? onOpenNote(note) : onCreateNote())}
          activeOpacity={0.8}
        >
          <View style={styles.tileHeader}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="description" size={14} color="#F59E0B" />
              <Text style={[styles.tileTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                RECENT NOTE
              </Text>
            </View>
            {note?.pinned && (
              <MaterialIcons name="push-pin" size={12} color={theme.colors.primary} />
            )}
          </View>

          {note ? (
            <View style={styles.tileBody}>
              <Text
                style={[styles.noteTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}
                numberOfLines={1}
              >
                {note.title || 'Untitled Note'}
              </Text>
              <Text
                style={[styles.noteSnippet, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}
                numberOfLines={3}
              >
                {note.preview || 'No content preview'}
              </Text>
              <View style={styles.tileFooter}>
                <MaterialIcons name="schedule" size={10} color={theme.colors.textSecondary} />
                <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                  {formatRelativeTime(note.updatedAt)}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="note-add" size={20} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Tap to create note
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── ROW 2: Tile C (Sketch) & Tile D (Quick Capture Dock) ── */}
      <View style={styles.row}>
        {/* Tile C: Recent Sketch Thumbnail */}
        <TouchableOpacity
          style={[styles.tile, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border, minHeight: tileMinHeight }]}
          onPress={() => (sketch ? onOpenSketch(sketch) : onCreateSketch())}
          activeOpacity={0.8}
        >
          <View style={styles.tileHeader}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="brush" size={14} color="#6366F1" />
              <Text style={[styles.tileTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                LATEST SKETCH
              </Text>
            </View>
            <TouchableOpacity onPress={onCreateSketch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="add" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>

          {sketch ? (
            <View style={styles.sketchBody}>
              {sketch.thumbnailUri ? (
                <View style={styles.sketchThumbWrap}>
                  <Image source={{ uri: sketch.thumbnailUri }} style={styles.sketchImage} resizeMode="cover" />
                </View>
              ) : (
                <View style={[styles.sketchPlaceholder, { backgroundColor: theme.colors.secondary }]}>
                  <MaterialIcons name="gesture" size={24} color="#6366F1" />
                </View>
              )}
              <Text
                style={[styles.sketchTitleText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}
                numberOfLines={1}
              >
                {sketch.title || 'Untitled Sketch'}
              </Text>
              <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
                {formatDrawingTime(sketch.updatedAt)}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="gesture" size={20} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Tap to start sketch
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Tile D: Quick Capture Actions */}
        <View style={[styles.tile, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border, minHeight: tileMinHeight }]}>
          <View style={styles.tileHeader}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="bolt" size={14} color={theme.colors.primary} />
              <Text style={[styles.tileTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                QUICK CAPTURE
              </Text>
            </View>
          </View>

          <View style={styles.captureActionsColumn}>
            <TouchableOpacity
              style={[styles.captureBtn, { backgroundColor: theme.colors.secondary }]}
              onPress={onPressNewTask}
              activeOpacity={0.7}
            >
              <MaterialIcons name="add-task" size={15} color="#10B981" />
              <Text style={[styles.captureBtnText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                + Task
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureBtn, { backgroundColor: theme.colors.secondary }]}
              onPress={onCreateNote}
              activeOpacity={0.7}
            >
              <MaterialIcons name="edit-note" size={16} color="#F59E0B" />
              <Text style={[styles.captureBtnText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                + Note
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureBtn, { backgroundColor: theme.colors.secondary }]}
              onPress={onCreateSketch}
              activeOpacity={0.7}
            >
              <MaterialIcons name="gesture" size={15} color="#6366F1" />
              <Text style={[styles.captureBtnText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                + Sketch
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    minHeight: 145,
    justifyContent: 'space-between',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileTitle: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  tileBody: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 11,
    textAlign: 'center',
  },
  taskItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 3.5,
  },
  miniCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskItemText: {
    fontSize: 12,
    flex: 1,
  },
  noteTitle: {
    fontSize: 12.5,
    marginBottom: 3,
  },
  noteSnippet: {
    fontSize: 11,
    lineHeight: 15,
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  footerText: {
    fontSize: 10,
  },
  sketchBody: {
    flex: 1,
    alignItems: 'flex-start',
  },
  sketchThumbWrap: {
    width: '100%',
    height: 52,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    marginBottom: 6,
  },
  sketchImage: {
    width: '100%',
    height: '100%',
  },
  sketchPlaceholder: {
    width: '100%',
    height: 52,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  sketchTitleText: {
    fontSize: 12,
    marginBottom: 2,
  },
  captureActionsColumn: {
    flex: 1,
    justifyContent: 'space-around',
    gap: 5,
  },
  captureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  captureBtnText: {
    fontSize: 11.5,
  },
});
