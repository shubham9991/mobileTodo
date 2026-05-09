import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { MaterialIcons } from '@expo/vector-icons';
import { format, parseISO, eachDayOfInterval, isValid } from 'date-fns';
import { useTheme } from '../../themes/ThemeContext';
import { useManage } from '../../core/ManageContext';
import { TopNavbar } from '../../layout/TopNavbar';
import { BottomNavbar } from '../../layout/BottomNavbar';
import { FABMenu } from '../../core/components/FABMenu';
import { useFabBottom } from '../../core/hooks/useFabBottom';
import { dummyData } from '../../core/dummyData';

// ─── Utility ──────────────────────────────────────────────────────────────────
function toISO(dateStr: string): string | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const today = new Date();
  const lower = dateStr.toLowerCase();
  if (lower === 'today') return format(today, 'yyyy-MM-dd');
  if (lower === 'tomorrow') {
    const t = new Date(today); t.setDate(t.getDate() + 1);
    return format(t, 'yyyy-MM-dd');
  }
  const attempt = new Date(`${dateStr}, ${today.getFullYear()}`);
  return isValid(attempt) ? format(attempt, 'yyyy-MM-dd') : null;
}

function isoToFriendly(iso: string): string {
  const d = parseISO(iso);
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(new Date(new Date().getTime() + 86400000), 'yyyy-MM-dd');
  if (iso === today) return 'Today';
  if (iso === tomorrow) return 'Tomorrow';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

// ─── Agenda Item Card ─────────────────────────────────────────────────────────
const AgendaCard = ({ item, type }: { item: any; type: 'event' | 'task' }) => {
  const { theme } = useTheme();
  const accentColor = item.color ?? theme.colors.primary;

  return (
    <View style={[agendaStyles.card, { backgroundColor: theme.colors.cardPrimary, borderLeftColor: accentColor }]}>
      <View style={agendaStyles.cardInner}>
        <View style={agendaStyles.timeCol}>
          <Text style={[agendaStyles.time, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
            {item.startTime ?? item.dueTime ?? '—'}
          </Text>
          {item.endTime && (
            <Text style={[agendaStyles.endTime, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
              {item.endTime}
            </Text>
          )}
        </View>
        <View style={agendaStyles.content}>
          <View style={agendaStyles.titleRow}>
            <MaterialIcons
              name={type === 'event' ? 'event' : 'check-circle-outline'}
              size={13}
              color={accentColor}
              style={{ marginTop: 1 }}
            />
            <Text style={[agendaStyles.title, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
              {item.title}
            </Text>
          </View>
          <View style={agendaStyles.metaRow}>
            {item.tag && (
              <View style={[agendaStyles.tagPill, { backgroundColor: `${accentColor}20` }]}>
                <Text style={[agendaStyles.tagText, { color: accentColor, fontFamily: 'Inter_600SemiBold' }]}>
                  {item.tag}
                </Text>
              </View>
            )}
            {item.location && (
              <View style={agendaStyles.metaItem}>
                <MaterialIcons name="place" size={10} color={theme.colors.textSecondary} />
                <Text style={[agendaStyles.metaText, { color: theme.colors.textSecondary }]}>{item.location}</Text>
              </View>
            )}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={theme.colors.border} />
      </View>
    </View>
  );
};

const agendaStyles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderLeftWidth: 3,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  timeCol: { width: 52, alignItems: 'flex-end' },
  time: { fontSize: 12 },
  endTime: { fontSize: 10, marginTop: 2 },
  content: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  title: { fontSize: 14, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  metaText: { fontSize: 10, fontFamily: 'Inter_400Regular' },
});

// ─── Main Calendar Screen ──────────────────────────────────────────────────────
export const CalendarScreen = () => {
  const { theme } = useTheme();
  const { tags, calendarMarkings } = useManage();
  const fabBottom = useFabBottom();
  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const [selectedISO, setSelectedISO] = useState(todayISO);

  // Tag color map
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach(t => {
      const s = calendarMarkings.find(m => m.tagId === t.id);
      if (!s || s.visible) map[t.id] = t.color;
    });
    return map;
  }, [tags, calendarMarkings]);

  // Build marked dates: period tasks + event dots
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    // Period tasks
    dummyData.taskGroups.flatMap(g => g.tasks).forEach(task => {
      if (!task.dueDate || !task.dueEndDate) return;
      const s = toISO(task.dueDate); const e = toISO(task.dueEndDate);
      if (!s || !e) return;
      const sd = parseISO(s); const ed = parseISO(e);
      if (!isValid(sd) || !isValid(ed) || ed < sd) return;
      const tagId = task.tagType ?? 'work';
      const tagSetting = calendarMarkings.find(m => m.tagId === tagId);
      if (tagSetting && !tagSetting.visible) return;
      const color = tagColorMap[tagId] ?? theme.colors.primary;
      eachDayOfInterval({ start: sd, end: ed }).forEach((day, idx, arr) => {
        const iso = format(day, 'yyyy-MM-dd');
        if (!marks[iso]) marks[iso] = { periods: [] };
        if (!marks[iso].periods) marks[iso].periods = [];
        marks[iso].periods.push({ startingDay: idx === 0, endingDay: idx === arr.length - 1, color });
      });
    });

    // Event dots
    Object.entries(dummyData.eventsData.eventsByDate).forEach(([dayStr, evts]) => {
      const iso = `2026-03-${String(parseInt(dayStr, 10)).padStart(2, '0')}`;
      const evtList = evts as any[];
      if (!evtList.length) return;
      if (!marks[iso]) marks[iso] = {};
      if (!marks[iso].periods) {
        marks[iso].dots = evtList.slice(0, 3).map((e: any) => ({ key: e.id, color: e.color ?? theme.colors.primary }));
      }
    });

    // Selected day
    if (!marks[selectedISO]) marks[selectedISO] = {};
    marks[selectedISO].selected = true;
    marks[selectedISO].selectedColor = theme.colors.primary;

    return marks;
  }, [selectedISO, tagColorMap, calendarMarkings, theme.colors.primary]);

  const hasAnyPeriod = useMemo(
    () => Object.values(markedDates).some((m: any) => m.periods?.length > 0),
    [markedDates]
  );

  // Build agenda sections for selected day
  const agendaSections = useMemo(() => {
    const dayNum = parseInt(selectedISO.split('-')[2], 10);
    const events = (dummyData.eventsData.eventsByDate[dayNum] ?? []) as any[];
    const allTasks = dummyData.taskGroups.flatMap(g => g.tasks);
    const tasks = allTasks.filter(t => {
      const iso = toISO(t.dueDate ?? '');
      if (!iso) return false;
      if (iso === selectedISO) return true;
      // Period task that spans this day
      if (t.dueEndDate) {
        const endISO = toISO(t.dueEndDate);
        return endISO && selectedISO >= iso && selectedISO <= endISO;
      }
      return false;
    });

    const sections = [];
    if (events.length > 0) sections.push({ title: 'Events', data: events.map(e => ({ ...e, _type: 'event' })) });
    if (tasks.length > 0) sections.push({ title: 'Tasks', data: tasks.map(t => ({ ...t, _type: 'task', color: tagColorMap[t.tagType ?? ''] ?? theme.colors.primary })) });
    return sections;
  }, [selectedISO, tagColorMap, theme.colors.primary]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'left', 'right']}>
      <TopNavbar />

      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]} contentContainerStyle={{ paddingBottom: fabBottom + 80 }}>
        {/* Sticky Calendar */}
        <View style={{ backgroundColor: theme.colors.background }}>
          <Calendar
            current={selectedISO}
            onDayPress={(day: DateData) => setSelectedISO(day.dateString)}
            markingType={hasAnyPeriod ? 'multi-period' : 'multi-dot'}
            markedDates={markedDates}
            enableSwipeMonths={false}
            theme={{
              backgroundColor: theme.colors.background,
              calendarBackground: theme.colors.background,
              textSectionTitleColor: theme.colors.textSecondary,
              selectedDayBackgroundColor: theme.colors.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: theme.colors.primary,
              dayTextColor: theme.colors.text,
              textDisabledColor: theme.colors.textSecondary + '40',
              arrowColor: theme.colors.textSecondary,
              monthTextColor: theme.colors.text,
              indicatorColor: theme.colors.primary,
              textDayFontFamily: 'Inter_500Medium',
              textMonthFontFamily: 'Inter_600SemiBold',
              textDayHeaderFontFamily: 'Inter_500Medium',
              textDayFontSize: 14,
              textMonthFontSize: 16,
              textDayHeaderFontSize: 12,
            }}
            renderArrow={(direction: 'left' | 'right') => (
              <MaterialIcons
                name={direction === 'left' ? 'chevron-left' : 'chevron-right'}
                size={24}
                color={theme.colors.textSecondary}
              />
            )}
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        </View>

        {/* Agenda */}
        <View style={styles.agendaContainer}>
          <Text style={[styles.agendaDate, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
            {isoToFriendly(selectedISO)}
          </Text>

          {agendaSections.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="event-available" size={40} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Nothing scheduled for this day
              </Text>
            </View>
          ) : (
            agendaSections.map(section => (
              <View key={section.title}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, fontFamily: 'Inter_600SemiBold' }]}>
                  {section.title.toUpperCase()}
                </Text>
                {section.data.map((item: any) => (
                  <AgendaCard key={item.id} item={item} type={item._type} />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <FABMenu bottom={fabBottom} />
      <BottomNavbar />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginTop: 4 },
  agendaContainer: { paddingHorizontal: 16, paddingTop: 16 },
  agendaDate: { fontSize: 20, letterSpacing: -0.4, marginBottom: 16 },
  sectionTitle: { fontSize: 11, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyText: { fontSize: 14 },
});
