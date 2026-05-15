# DateTimePicker Implementation Plan (MS Teams Inspired)

## Overview
Redesign the `DateTimePicker` component to emulate the scheduling experience found in Microsoft Teams. The design will focus on a seamless transition between single-day and multi-day events, utilizing a combination of a visual calendar for "gliding" selections and precise dropdowns for exact date/time inputs.

## Key Features & Requirements

### 1. Date Selection (Calendar View)
- **Single Date**: User can tap a single date.
- **Multi-Date (Glide)**: User can hold and swipe (glide) across the calendar to select a date range.
- **Auto-Sync**: Gliding and selecting a multi-date range will automatically toggle the "multi-date" state and pre-fill the Start Date and End Date dropdowns in the Time Section.

### 2. Time Section
Located below the calendar, this section controls exact scheduling.
- **Dynamic Date Fields**: 
  - **Single Date Mode**: Displays only ONE Date field alongside the Start and End Time fields.
  - **Multi-Date Mode**: When a multi-date range is selected via the calendar glide, a second Date field (End Date) is activated/displayed.
  - Do NOT use Android's default date picker; always use the existing custom calendar for date selection.
- **Time Selection**:
  - Start Time and End Time selectors.
  - End Time dropdown dynamically displays the duration relative to the Start Time (e.g., `5:00 am (30m)`, `5:30 am (1h)`).
  - Use a custom dropdown for these options, or optionally leverage the Android default time selector.
- **All Day & Duration**:
  - Include an "All day" switch.
  - Display the total duration label next to it (e.g., `30m`).

### 3. Recurrence / Repeat Options
- Include a dropdown menu for recurrence mirroring MS Teams:
  - Does not repeat
  - Every weekday (Mon - Fri)
  - Daily
  - Weekly
  - Monthly
  - Yearly
  - Custom

## UI Layout Outline
```text
[       Existing Custom Calendar       ]
[ (Supports Tap and Glide for range)   ]

----- Time Section -----
[ Date 1 (Start) ]  [ Start Time ▼ ]
[ Date 2 (End) * ]  [ End Time ▼   ] 
* Date 2 is hidden/inactive until a multi-date range is selected.

[ Duration (e.g. 30m) ]  [ Toggle: All day ]

[ Repeat: Does not repeat ▼ ]

Repeat: [ Do not repeat ▼ ]
```

## Step-by-Step Implementation Strategy

1. **State Management Setup**:
   - Define React state for `startDate`, `endDate`, `startTime`, `endTime`, `isMultiDay`, and `recurrenceRule`.
2. **Calendar Gesture Integration**:
   - Ensure the calendar component correctly handles the drag/glide gesture for range selection.
   - Wire the gesture callbacks to update both `startDate` and `endDate` and toggle `isMultiDay` to true.
3. **Dropdown Components Construction**:
   - Build a searchable/typable Time Dropdown component that parses user text into valid time objects.
   - Build Date Dropdowns that act as a two-way bind with the calendar state.
4. **Validation Logic (Time Constraints)**:
   - Add effects or handler checks to ensure `endTime >= startTime` when `startDate === endDate`.
5. **Recurrence UI**:
   - Add the simple selector for recurrence options.
6. **Integration & Styling**:
   - Integrate these pieces into `DateTimePicker.tsx`.
   - Apply styling to match a professional, compact, MS Teams-like interface.
