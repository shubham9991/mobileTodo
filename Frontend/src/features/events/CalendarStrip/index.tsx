import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, LayoutAnimation,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../themes/ThemeContext';

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// --- March 2026 grid (Mon-first, Mar 1 = Sunday)
// null = padding cell before/after month
const MARCH_2026_GRID: (number | null)[][] = [
  [null, null, null, null, null, null, 1   ],
  [2,   3,   4,   5,   6,   7,   8   ],
  [9,   10,  11,  12,  13,  14,  15  ],
  [16,  17,  18,  19,  20,  21,  22  ],
  [23,  24,  25,  26,  27,  28,  29  ],
  [30,  31,  null, null, null, null, null],
];

// Which week row contains a given date
const getWeekRowIndex = (date: number): number => {
  for (let r = 0; r < MARCH_2026_GRID.length; r++) {
    if (MARCH_2026_GRID[r].includes(date)) return r;
  }
  return 0;
};

// Event dots — dates that have events in our dummy data
const EVENT_DATES = new Set([24, 26, 27, 28]);

interface Props {
  activeDate: number;
  onSelectDate: (date: number) => void;
}

export const CalendarStrip = ({ activeDate, onSelectDate }: Props) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const activeWeekRow = getWeekRowIndex(activeDate);
  // In collapsed mode show just the week row containing the active date
  const visibleRows = expanded ? MARCH_2026_GRID : [MARCH_2026_GRID[activeWeekRow]];

  const toggleExpand = () => {
    LayoutAnimation.configureNext({
      duration: 280,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring',        springDamping: 0.8 },
    });
    setExpanded((e) => !e);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
      {/* ── Month / Navigation row ───────────────────── */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navBtn}>
          <MaterialIcons name="chevron-left" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.monthCenter}>
          <MaterialIcons name="calendar-month" size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.monthLabel, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
            March 2026
          </Text>
        </View>

        <TouchableOpacity style={styles.navBtn}>
          <MaterialIcons name="chevron-right" size={22} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Day-of-week headers ───────────────────────── */}
      <View style={styles.dayHeaderRow}>
        {DAY_HEADERS.map((d) => (
          <Text
            key={d}
            style={[styles.dayHeader, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* ── Calendar Grid (1 row or all rows) ─────────── */}
      <View style={styles.grid}>
        {visibleRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((date, colIndex) => {
              if (date === null) {
                return <View key={colIndex} style={styles.dayCell} />;
              }

              const isActive  = date === activeDate;
              const hasEvent  = EVENT_DATES.has(date);
              const isToday   = date === 27; // THU Mar 27 is "today"

              return (
                <TouchableOpacity
                  key={colIndex}
                  style={[
                    styles.dayCell,
                    isActive && [styles.activeDayCell, { backgroundColor: theme.colors.primary }],
                  ]}
                  onPress={() => onSelectDate(date)}
                >
                  {/* Today ring */}
                  {isToday && !isActive && (
                    <View style={[styles.todayRing, { borderColor: theme.colors.primary }]} />
                  )}

                  <Text style={[
                    styles.dayNumber,
                    { color: theme.colors.text, fontFamily: 'Inter_500Medium' },
                    isActive && { color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
                    date < 27 && !isActive && { color: theme.colors.textSecondary },
                  ]}>
                    {date}
                  </Text>

                  {/* Event dot */}
                  {hasEvent && (
                    <View style={[
                      styles.eventDot,
                      { backgroundColor: isActive ? 'rgba(255,255,255,0.7)' : theme.colors.primary },
                    ]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* ── Expand / Collapse toggle ─────────────────── */}
      <TouchableOpacity style={[styles.toggleBtn, { borderTopColor: theme.colors.border }]} onPress={toggleExpand}>
        <Text style={[styles.toggleText, { color: theme.colors.textSecondary, fontFamily: 'Inter_500Medium' }]}>
          {expanded ? 'Collapse' : 'Show full month'}
        </Text>
        <MaterialIcons
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={18}
          color={theme.colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
  },
  navBtn: { padding: 4 },
  monthCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthLabel: {
    fontSize: 15,
    letterSpacing: -0.2,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  grid: {
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dayCell: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  activeDayCell: {
    borderRadius: 8,
  },
  todayRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  dayNumber: {
    fontSize: 13,
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toggleText: {
    fontSize: 12,
  },
});
