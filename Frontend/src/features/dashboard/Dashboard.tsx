import React from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { useDashboard, SectionId } from '../../core/DashboardContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { FABMenu } from '../../core/components/FABMenu';
import { HeroWidgetSection } from './HeroWidgetSection';
import { SearchAndFilter } from './SearchAndFilter';
import { CategoryTabs } from './CategoryTabs';
import { TodaysTasks } from './TodaysTasks';
import { RecentNotes } from './RecentNotes';
import { Upcoming } from './Upcoming';

// Section spacing per layout mode
const SECTION_GAP: Record<string, number> = {
  compact:     4,
  comfortable: 8,
  expanded:    16,
};

// Map each section ID to its component
const SectionComponent = ({ id }: { id: SectionId }) => {
  switch (id) {
    case 'hero':     return <HeroWidgetSection />;
    case 'search':   return <SearchAndFilter />;
    case 'tabs':     return <CategoryTabs />;
    case 'tasks':    return <TodaysTasks />;
    case 'notes':    return <RecentNotes />;
    case 'upcoming': return <Upcoming />;
    default:         return null;
  }
};

export const Dashboard = () => {
  const { theme }                                      = useTheme();
  const { sectionOrder, sectionVisibility, layoutMode } = useDashboard();
  const fabBottom                                       = useFabBottom();

  const gap = SECTION_GAP[layoutMode] ?? 8;

  // Only render sections that are visible, in the configured order
  const visibleSections = sectionOrder.filter((id) => sectionVisibility[id]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <TopNavbar />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {visibleSections.map((id, index) => (
          <View key={id} style={{ marginTop: index === 0 ? 0 : gap }}>
            <SectionComponent id={id} />
          </View>
        ))}
      </ScrollView>

      <FABMenu bottom={fabBottom} />

      <BottomNavbar />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  fab: {
    position: 'absolute',
    right: 20,
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
