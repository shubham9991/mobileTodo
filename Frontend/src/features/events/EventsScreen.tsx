import React, { useState, useMemo } from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
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
import { format } from 'date-fns';
import { useRouter } from 'expo-router';

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
  const router = useRouter();
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const [activeISO, setActiveISO] = useState<string>(todayISO);
  const fabBottom = useFabBottom();

  // When the user taps a date, update local state AND navigate to the
  // Calendar tab in Day view for that date via a URL param.
  const handleSelectDate = (iso: string) => {
    setActiveISO(iso);
    router.push(`/(tabs)/calendar?date=${iso}` as any);
  };

  // EventsByDate is keyed by day number (legacy). Map ISO → day number for lookup.
  const activeDayNum = useMemo(() => {
    const parts = activeISO.split('-');
    return parseInt(parts[2], 10);
  }, [activeISO]);

  const events = dummyData.eventsData.eventsByDate[activeDayNum] || [];

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
        {/* 0: Sticky full calendar with multi-period + multi-dot marking */}
        <View style={{ backgroundColor: theme.colors.background }}>
          <CalendarStrip
            activeDate={activeISO}
            onSelectDate={handleSelectDate}
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
              {events.map((event: any) => (
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
});
