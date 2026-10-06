import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../themes/ThemeContext';
import { WidgetSize } from '../dashboardPrefsStore';

interface WidgetContextMenuModalProps {
  visible: boolean;
  onClose: () => void;
  widgetTitle: string;
  widgetIcon: keyof typeof MaterialIcons.glyphMap;
  currentSize?: WidgetSize;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onToggleSize?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onOpenAddLibrary?: () => void;
  onRemoveWidget?: () => void;
}

export const WidgetContextMenuModal = ({
  visible,
  onClose,
  widgetTitle,
  widgetIcon,
  currentSize = 'half',
  canMoveUp = true,
  canMoveDown = true,
  onToggleSize,
  onMoveUp,
  onMoveDown,
  onOpenAddLibrary,
  onRemoveWidget,
}: WidgetContextMenuModalProps) => {
  const { theme } = useTheme();

  const handleAction = (fn?: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (fn) fn();
    onClose();
  };

  const nextSizeLabel = currentSize === 'half' ? 'Expand to Full Width (2x1)' : 'Shrink to Half Width (1x1)';
  const nextSizeIcon = currentSize === 'half' ? 'fullscreen' : 'fullscreen-exit';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

        <SafeAreaView style={[styles.menuCard, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: `${theme.colors.primary}18` }]}>
                <MaterialIcons name={widgetIcon} size={18} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                  {widgetTitle}
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                  Widget Customization
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Action List */}
          <View style={styles.actionsList}>
            {/* 1. Resize Width */}
            {onToggleSize && (
              <TouchableOpacity
                style={[styles.actionRow, { borderBottomColor: theme.colors.border }]}
                onPress={() => handleAction(onToggleSize)}
                activeOpacity={0.7}
              >
                <View style={styles.actionLeft}>
                  <MaterialIcons name={nextSizeIcon as any} size={20} color={theme.colors.primary} />
                  <Text style={[styles.actionText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                    {nextSizeLabel}
                  </Text>
                </View>
                <View style={[styles.tag, { backgroundColor: theme.colors.secondary }]}>
                  <Text style={[styles.tagText, { color: theme.colors.textSecondary }]}>
                    Current: {currentSize === 'half' ? '1x1' : '2x1'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 2. Move Up */}
            {onMoveUp && canMoveUp && (
              <TouchableOpacity
                style={[styles.actionRow, { borderBottomColor: theme.colors.border }]}
                onPress={() => handleAction(onMoveUp)}
                activeOpacity={0.7}
              >
                <View style={styles.actionLeft}>
                  <MaterialIcons name="arrow-upward" size={20} color={theme.colors.text} />
                  <Text style={[styles.actionText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                    Move Up in Order
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 3. Move Down */}
            {onMoveDown && canMoveDown && (
              <TouchableOpacity
                style={[styles.actionRow, { borderBottomColor: theme.colors.border }]}
                onPress={() => handleAction(onMoveDown)}
                activeOpacity={0.7}
              >
                <View style={styles.actionLeft}>
                  <MaterialIcons name="arrow-downward" size={20} color={theme.colors.text} />
                  <Text style={[styles.actionText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                    Move Down in Order
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 4. Add Widget from Library */}
            {onOpenAddLibrary && (
              <TouchableOpacity
                style={[styles.actionRow, { borderBottomColor: theme.colors.border }]}
                onPress={() => handleAction(onOpenAddLibrary)}
                activeOpacity={0.7}
              >
                <View style={styles.actionLeft}>
                  <MaterialIcons name="add-circle-outline" size={20} color="#10B981" />
                  <Text style={[styles.actionText, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
                    Add More Widgets...
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}

            {/* 5. Remove Widget */}
            {onRemoveWidget && (
              <TouchableOpacity
                style={[styles.actionRow, { borderBottomColor: 'transparent' }]}
                onPress={() => handleAction(onRemoveWidget)}
                activeOpacity={0.7}
              >
                <View style={styles.actionLeft}>
                  <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                  <Text style={[styles.actionText, { color: '#EF4444', fontFamily: 'Inter_500Medium' }]}>
                    Remove from Page
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menuCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  actionsList: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 13.5,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 10.5,
  },
});
