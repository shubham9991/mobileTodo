import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../../themes/ThemeContext';
import { useDashboard, DashboardView } from '../../core/DashboardContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { FABMenu } from '../../core/components/FABMenu';
import { TaskComposer } from '../../core/components/TaskComposer';

// Multi-View Dashboard Components & Views
import { ViewModeSelector } from './components/ViewModeSelector';
import { BentoHubView, FocusStreamView, CreativeStudioView, MinimalistView } from './views';
import { DashboardViewMode } from './dashboardPrefsStore';

// Custom Modals
import { FolderTree } from './FolderTree';
import { ViewConfigModal } from './ViewConfigModal';
import { GlobalSearchModal } from '../search/GlobalSearchModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ALL_MODES: readonly DashboardViewMode[] = ['bento', 'focus', 'studio', 'minimal'] as const;

export const Dashboard = () => {
  const { theme } = useTheme();
  const router = useRouter();
  const { 
    views, 
    activeViewIndex, 
    updateTask,
    handleComposerSave,
    activeViewMode,
    setActiveViewMode,
    dashboardPrefs,
  } = useDashboard();
  
  const fabBottom = useFabBottom();
  const flatListRef = useRef<FlatList>(null);

  // Modal states
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedViewToEdit, setSelectedViewToEdit] = useState<DashboardView | null>(null);

  const activeView = views[activeViewIndex] || views[0];

  // Bidirectional sync: when activeViewMode changes, scroll FlatList pager smoothly
  useEffect(() => {
    if (dashboardPrefs.enableSwipePager && flatListRef.current) {
      const idx = ALL_MODES.indexOf(activeViewMode);
      if (idx !== -1) {
        flatListRef.current.scrollToIndex({ index: idx, animated: true });
      }
    }
  }, [activeViewMode, dashboardPrefs.enableSwipePager]);

  // Stable toggle callback
  const handleToggleTask = useCallback((taskId: string) => {
    updateTask(taskId, t => ({ ...t, completed: !t.completed }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [updateTask]);

  // Multi-View Dashboard View Renderer
  const renderDashboardView = useCallback((mode: DashboardViewMode) => {
    switch (mode) {
      case 'bento':
        return (
          <BentoHubView
            onOpenComposer={() => setShowTaskComposer(true)}
            onToggleTask={handleToggleTask}
          />
        );
      case 'focus':
        return (
          <FocusStreamView
            onOpenComposer={() => setShowTaskComposer(true)}
            onToggleTask={handleToggleTask}
          />
        );
      case 'studio':
        return (
          <CreativeStudioView
            onOpenTasksTab={() => router.push('/(tabs)/tasks')}
          />
        );
      case 'minimal':
        return (
          <MinimalistView
            onOpenComposer={() => setShowTaskComposer(true)}
            onToggleTask={handleToggleTask}
            onOpenSearch={() => setShowSearch(true)}
          />
        );
      default:
        return (
          <BentoHubView
            onOpenComposer={() => setShowTaskComposer(true)}
            onToggleTask={handleToggleTask}
          />
        );
    }
  }, [handleToggleTask, router]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      {/* Top Navigation Navbar with Menu sidebar trigger */}
      <TopNavbar onPressMenu={() => setShowSidebar(true)} />

      {/* Multi-View Mode Switcher (Bento, Focus, Studio, Minimal) */}
      <ViewModeSelector
        onOpenSettings={() => {
          setSelectedViewToEdit(activeView);
          setShowSettings(true);
        }}
      />

      {/* Main Dashboard Content */}
      <View style={{ flex: 1 }}>
        {dashboardPrefs.enableSwipePager ? (
          <FlatList
            ref={flatListRef}
            data={ALL_MODES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            initialScrollIndex={
              activeViewMode === 'focus' ? 1 : activeViewMode === 'studio' ? 2 : activeViewMode === 'minimal' ? 3 : 0
            }
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
              }, 50);
            }}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (ALL_MODES[idx] && ALL_MODES[idx] !== activeViewMode) {
                setActiveViewMode(ALL_MODES[idx]);
              }
            }}
            getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            renderItem={({ item }) => (
              <View style={{ width: SCREEN_WIDTH, flex: 1 }}>
                {renderDashboardView(item)}
              </View>
            )}
          />
        ) : (
          renderDashboardView(activeViewMode)
        )}
      </View>

      <FABMenu bottom={fabBottom} />

      <BottomNavbar />

      {/* Quick Task Composer Modal */}
      {showTaskComposer && (
        <TaskComposer
          visible={showTaskComposer}
          onClose={() => setShowTaskComposer(false)}
          onSave={(taskData) => {
            handleComposerSave(taskData);
            setShowTaskComposer(false);
          }}
        />
      )}

      {/* Slideout Collapsible project tree sidebar drawer */}
      <FolderTree 
        visible={showSidebar} 
        onClose={() => setShowSidebar(false)} 
      />

      {/* Bottom Sheet Display View Configurations modal */}
      <ViewConfigModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        view={selectedViewToEdit || activeView}
      />

      {/* Universal Search Modal (triggered from Minimalist dock or header) */}
      <GlobalSearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
