import React, { useState, useRef, useCallback } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet, Pressable,
  LayoutAnimation, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';

interface QuickAddBarProps {
  onAddTask?: (title: string) => void;
  onFocus?: () => void;
  placeholder?: string;
}

export const QuickAddBar = ({ onAddTask, onFocus, placeholder = 'Add a task...' }: QuickAddBarProps) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleFocus = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(true);
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    if (!title.trim()) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(false);
    }
    setIsFocused(false);
  }, [title]);

  const handleSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (trimmed && onAddTask) {
      onAddTask(trimmed);
      setTitle('');
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(false);
      inputRef.current?.blur();
    }
  }, [title, onAddTask]);

  const handleCancel = useCallback(() => {
    setTitle('');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(false);
    inputRef.current?.blur();
  }, []);

  return (
    <View style={[
      styles.container,
      { 
        backgroundColor: theme.colors.cardPrimary,
        borderColor: isFocused ? theme.colors.primary : theme.colors.border,
      },
      isExpanded && styles.containerExpanded,
    ]}>
      {/* Main Input Row */}
      <View style={styles.inputRow}>
        <TouchableOpacity
          style={[
            styles.addButton,
            { backgroundColor: title.trim() ? theme.colors.primary : theme.colors.secondary }
          ]}
          onPress={handleSubmit}
          disabled={!title.trim()}
          activeOpacity={0.7}
        >
          <MaterialIcons 
            name="add" 
            size={20} 
            color={title.trim() ? theme.colors.primaryText : theme.colors.textSecondary} 
          />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            { color: theme.colors.text, fontFamily: 'Inter_400Regular' }
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textSecondary}
          value={title}
          onChangeText={setTitle}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          multiline={false}
          maxLength={200}
        />

        {title.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setTitle('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="close" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded Actions Row */}
      {isExpanded && (
        <View style={styles.actionsRow}>
          <View style={styles.quickActions}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.secondary }]}>
              <MaterialIcons name="calendar-month" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.secondary }]}>
              <MaterialIcons name="flag" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.secondary }]}>
              <MaterialIcons name="local-offer" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.colors.secondary }]}>
              <MaterialIcons name="notifications" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.rightActions}>
            <TouchableOpacity 
              style={[styles.cancelBtn]} 
              onPress={handleCancel}
            >
              <MaterialIcons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.submitBtn, 
                { 
                  backgroundColor: title.trim() ? theme.colors.primary : theme.colors.secondary,
                  opacity: title.trim() ? 1 : 0.5
                }
              ]} 
              onPress={handleSubmit}
              disabled={!title.trim()}
            >
              <MaterialIcons 
                name="arrow-upward" 
                size={18} 
                color={title.trim() ? theme.colors.primaryText : theme.colors.textSecondary} 
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  containerExpanded: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    lineHeight: 20,
  },
  clearButton: {
    padding: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
