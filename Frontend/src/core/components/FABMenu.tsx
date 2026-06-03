import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, interpolate,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../themes/ThemeContext';
import { TaskComposer } from './TaskComposer';
import { useDashboard } from '../DashboardContext';

// ─── Note navigation helper ────────────────────────────────────────────────────
// Replaces AddNoteSheet — navigates to the full Lexical NoteScreen

// ─── Animated speed-dial option ───────────────────────────────────────────────
const Option = ({
  icon, label, iconBg, labelColor, translateY, opacity, onPress,
}: {
  icon: string; label: string; iconBg: string; labelColor: string;
  translateY: ReturnType<typeof useSharedValue<number>>;
  opacity: ReturnType<typeof useSharedValue<number>>;
  onPress: () => void;
}) => {
  const { theme } = useTheme();
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View style={[styles.optionRow, animStyle]}>
      <TouchableOpacity style={[styles.optionLabelWrap, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]} onPress={onPress}>
        <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>{label}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.optionBtn, { backgroundColor: iconBg }]} onPress={onPress}>
        <MaterialIcons name={icon as any} size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main FABMenu component ───────────────────────────────────────────────────
interface FABMenuProps { bottom: number; }

export const FABMenu = ({ bottom }: FABMenuProps) => {
  const { theme }       = useTheme();
  const { handleComposerSave } = useDashboard();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showTask, setShowTask] = useState(false);

  // Animation shared values
  const rotation     = useSharedValue(0);
  const noteY        = useSharedValue(40);
  const noteOpacity  = useSharedValue(0);
  const taskY        = useSharedValue(40);
  const taskOpacity  = useSharedValue(0);
  const backdropOp   = useSharedValue(0);

  const toggle = () => {
    if (open) {
      // Close
      rotation.value    = withTiming(0,  { duration: 200 });
      noteY.value       = withTiming(40, { duration: 150 });
      noteOpacity.value = withTiming(0,  { duration: 120 });
      taskY.value       = withTiming(40, { duration: 180 });
      taskOpacity.value = withTiming(0,  { duration: 120 });
      backdropOp.value  = withTiming(0,  { duration: 200 });
    } else {
      // Open — options stagger upward
      rotation.value    = withTiming(45, { duration: 200 });
      backdropOp.value  = withTiming(1,  { duration: 200 });
      taskY.value       = withSpring(0,  { damping: 15, stiffness: 200 });
      taskOpacity.value = withTiming(1,  { duration: 200 });
      noteY.value       = withSpring(0,  { damping: 13, stiffness: 180 });
      noteOpacity.value = withTiming(1,  { duration: 220 });
    }
    setOpen((o) => !o);
  };

  const closeAndOpen = (which: 'task' | 'note') => {
    toggle();
    if (which === 'note') {
      // Navigate to the full Lexical editor
      const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setTimeout(() => router.push({ pathname: '/note', params: { noteId: id } }), 250);
    } else {
      setTimeout(() => setShowTask(true), 250);
    }
  };

  const fabRotateStyle  = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(rotation.value, [0, 45], [0, 45])}deg` }],
  }));
  const backdropStyle   = useAnimatedStyle(() => ({ opacity: backdropOp.value }));

  return (
    <>
      {/* Backdrop */}
      {open && (
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={toggle} />
        </Animated.View>
      )}

      {/* Speed-dial options */}
      <View style={[styles.fabStack, { bottom }]}>
        {/* Note option (top) */}
        <Option
          icon="description"
          label="New Note"
          iconBg="#F97316"
          labelColor="#F97316"
          translateY={noteY}
          opacity={noteOpacity}
          onPress={() => closeAndOpen('note')}
        />
        {/* Task option (below note) */}
        <Option
          icon="task-alt"
          label="New Task"
          iconBg="#6366F1"
          labelColor="#6366F1"
          translateY={taskY}
          opacity={taskOpacity}
          onPress={() => closeAndOpen('task')}
        />

        {/* Main FAB */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.fabBg }]}
          onPress={toggle}
          activeOpacity={0.85}
        >
          <Animated.View style={fabRotateStyle}>
            <MaterialIcons name="add" size={26} color={theme.colors.fabText} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <TaskComposer visible={showTask} onClose={() => setShowTask(false)} onSave={(td) => { handleComposerSave(td); }} />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  fabStack: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    zIndex: 20,
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionLabelWrap: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 3,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  optionLabel: { fontSize: 13 },
  optionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
});
