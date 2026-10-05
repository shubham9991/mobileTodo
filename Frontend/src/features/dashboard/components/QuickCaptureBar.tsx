import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { generateDrawingId } from '../../drawing/drawingStore';

interface QuickCaptureBarProps {
  onPressNewTask: () => void;
  variant?: 'dock' | 'inline' | 'chips';
}

export const QuickCaptureBar = ({
  onPressNewTask,
  variant = 'dock',
}: QuickCaptureBarProps) => {
  const { theme } = useTheme();
  const router = useRouter();

  const handleNewNote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    router.push({ pathname: '/note', params: { noteId: id, noteTitle: '' } });
  };

  const handleNewSketch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const id = generateDrawingId();
    router.push({ pathname: '/drawing', params: { drawingId: id, drawingTitle: 'Untitled Sketch' } });
  };

  const handleNewTask = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPressNewTask();
  };

  if (variant === 'chips') {
    return (
      <View style={styles.chipsRow}>
        <TouchableOpacity
          style={[styles.chipBtn, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}
          onPress={handleNewTask}
          activeOpacity={0.7}
        >
          <MaterialIcons name="check-circle" size={15} color="#10B981" />
          <Text style={[styles.chipText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>+ Task</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chipBtn, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}
          onPress={handleNewNote}
          activeOpacity={0.7}
        >
          <MaterialIcons name="description" size={15} color="#F59E0B" />
          <Text style={[styles.chipText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>+ Note</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chipBtn, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}
          onPress={handleNewSketch}
          activeOpacity={0.7}
        >
          <MaterialIcons name="brush" size={15} color="#6366F1" />
          <Text style={[styles.chipText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>+ Sketch</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.dockContainer, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={handleNewTask}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: '#10B98115' }]}>
          <MaterialIcons name="add-task" size={18} color="#10B981" />
        </View>
        <Text style={[styles.btnLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Task</Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={handleNewNote}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: '#F59E0B15' }]}>
          <MaterialIcons name="edit-note" size={20} color="#F59E0B" />
        </View>
        <Text style={[styles.btnLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Note</Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={handleNewSketch}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: '#6366F115' }]}>
          <MaterialIcons name="gesture" size={18} color="#6366F1" />
        </View>
        <Text style={[styles.btnLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>Sketch</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  dockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontSize: 11,
  },
  divider: {
    width: 1,
    height: 24,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
});
