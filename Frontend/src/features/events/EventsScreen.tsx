import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../themes/ThemeContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { CalendarStrip } from './CalendarStrip';
import { EventCard } from './EventCard';
import { dummyData } from '../../core/dummyData';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { FABMenu } from '../../core/components/FABMenu';

// ── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = () => {
  const { theme } = useTheme();
  return (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconWrap, { backgroundColor: theme.colors.secondary }]}>
        <MaterialIcons name="event-busy" size={36} color={theme.colors.textSecondary} />
      </View>
      <Text style={[emptyStyles.title, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
        No events today
      </Text>
      <Text style={[emptyStyles.subtitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
        Pick another day or use the '+' menu to create one.
      </Text>
    </View>
  );
};

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ── Main Screen ──────────────────────────────────────────────────────────────
export const EventsScreen = () => {
  const { theme } = useTheme();
  const [activeDate, setActiveDate] = useState(27);
  const fabBottom = useFabBottom();

  const events = dummyData.eventsData.eventsByDate[activeDate] || [];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <TopNavbar />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: fabBottom + 60 }}
        stickyHeaderIndices={[0]}
      >
        {/* 0: Sticky expandable calendar */}
        <View style={{ backgroundColor: theme.colors.background }}>
          <CalendarStrip
            activeDate={activeDate}
            onSelectDate={setActiveDate}
          />
        </View>

        {/* 1: Events list for selected day */}
        <View style={styles.listContainer}>
          {events.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <View style={styles.listHeader}>
                <Text style={[styles.listHeaderText, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                  {events.length} EVENT{events.length !== 1 ? 'S' : ''}
                </Text>
              </View>
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <FABMenu bottom={fabBottom} />

      <BottomNavbar />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listHeader: {
    marginBottom: 10,
  },
  listHeaderText: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
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
