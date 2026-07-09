import React, { useRef, useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions, 
  Animated,
  Modal,
  TextInput
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { useDashboard, DashboardView } from '../../core/DashboardContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DashboardPagerProps {
  renderPageView: (view: DashboardView) => React.ReactElement;
  onPressAddView: () => void;
}

export const DashboardPager = ({ renderPageView, onPressAddView }: DashboardPagerProps) => {
  const { theme } = useTheme();
  const { views, activeViewIndex, setActiveViewIndex, createView } = useDashboard();
  const flatListRef = useRef<FlatList>(null);
  
  // Animation value for active dot sliding
  const dotWidths = useRef(views.map(() => new Animated.Value(8))).current;
  const [showAddModal, setShowAddModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [selectedLayout, setSelectedLayout] = useState<'list' | 'calendar' | 'paged'>('list');

  // Sync dot widths when activeViewIndex changes
  useEffect(() => {
    views.forEach((_, idx) => {
      Animated.spring(dotWidths[idx] || new Animated.Value(8), {
        toValue: idx === activeViewIndex ? 18 : 8,
        useNativeDriver: false,
        friction: 6,
        tension: 40,
      }).start();
    });
  }, [activeViewIndex, views]);

  const onScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    if (slideSize === 0) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    if (index !== activeViewIndex && index >= 0 && index < views.length) {
      setActiveViewIndex(index);
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const scrollToPage = (index: number) => {
    setActiveViewIndex(index);
    Haptics.selectionAsync().catch(() => {});
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleCreateView = () => {
    if (!newViewName.trim()) return;
    createView({
      name: newViewName.trim(),
      layout: selectedLayout,
      showCompleted: true,
      grouping: 'none',
      sorting: 'dueDate',
      filterDate: 'all',
      filterPriorities: ['HIGH', 'MED', 'LOW'],
      filterTags: [],
      filterSourceNodeId: null,
      widgets: [
        { id: 'tasks', visible: true },
        { id: 'hero', visible: false },
        { id: 'tabs', visible: false },
        { id: 'notes', visible: false },
        { id: 'upcoming', visible: false },
      ],
    });
    setNewViewName('');
    setShowAddModal(false);
    
    // Scroll to the newly created last page after a short delay
    setTimeout(() => {
      scrollToPage(views.length);
    }, 300);
  };

  return (
    <View style={styles.container}>
      {/* Swipeable Horizontal FlatList */}
      <FlatList
        ref={flatListRef}
        data={views}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH }}>
            {renderPageView(item)}
          </View>
        )}
      />

      {/* Pagination Dot Indicator Strip */}
      <View style={[styles.paginationContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.paginationStrip, { backgroundColor: theme.colors.secondary }]}>
          {views.map((_, index) => {
            const isActive = index === activeViewIndex;
            const animatedWidth = dotWidths[index] || 8;
            return (
              <TouchableOpacity
                key={index}
                onPress={() => scrollToPage(index)}
                style={styles.dotTouchTarget}
              >
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      width: animatedWidth,
                      backgroundColor: isActive ? theme.colors.primary : theme.colors.textSecondary,
                      borderRadius: 4,
                    }
                  ]}
                />
              </TouchableOpacity>
            );
          })}

          {/* Plus button to add a view page */}
          <TouchableOpacity
            style={styles.addBtnTouchTarget}
            onPress={() => setShowAddModal(true)}
          >
            <MaterialIcons name="add" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Add View Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.cardPrimary }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
              Create New Dashboard View
            </Text>

            <TextInput
              placeholder="View Name (e.g. Guyu, Tasks)"
              placeholderTextColor={theme.colors.textSecondary}
              style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border }]}
              value={newViewName}
              onChangeText={setNewViewName}
              autoFocus
            />

            {/* Layout selector cards */}
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
              Layout style
            </Text>
             <View style={styles.layoutSelectorRow}>
              {(['list', 'calendar', 'paged'] as const).map((lay) => (
                <TouchableOpacity
                  key={lay}
                  style={[
                    styles.layoutCard,
                    { 
                      borderColor: selectedLayout === lay ? theme.colors.primary : theme.colors.border,
                      backgroundColor: selectedLayout === lay ? theme.colors.secondary : 'transparent'
                    }
                  ]}
                  onPress={() => setSelectedLayout(lay)}
                >
                  <MaterialIcons 
                    name={lay === 'list' ? 'view-list' : lay === 'paged' ? 'pages' : 'calendar-today'} 
                    size={20} 
                    color={selectedLayout === lay ? theme.colors.primary : theme.colors.textSecondary} 
                  />
                  <Text style={{ 
                    color: selectedLayout === lay ? theme.colors.primary : theme.colors.textSecondary,
                    fontSize: 12,
                    marginTop: 4,
                    textTransform: 'capitalize',
                    fontFamily: 'Inter_500Medium'
                  }}>
                    {lay}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.btn, styles.cancelBtn]} 
                onPress={() => setShowAddModal(false)}
              >
                <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, styles.submitBtn, { backgroundColor: theme.colors.primary }]} 
                onPress={handleCreateView}
              >
                <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  paginationContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  dotTouchTarget: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  dot: {
    height: 8,
  },
  addBtnTouchTarget: {
    padding: 4,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  layoutSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  layoutCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
  },
  submitBtn: {
    minWidth: 80,
  },
});
