import notifee, { TimestampTrigger, TriggerType } from '@notifee/react-native';
import { addDays, nextDay, Day, addMinutes, addHours } from 'date-fns';

export async function requestNotificationPermission() {
  const settings = await notifee.requestPermission();
  return settings.authorizationStatus;
}

export async function scheduleReminder(
  taskId: string,
  title: string,
  dueDateStr: string,
  dueTimeStr: string,
  reminderChip: string // e.g., "15 min before"
) {
  if (!dueDateStr || !dueTimeStr || !reminderChip) return;

  // 1. Parse date
  const now = new Date();
  let targetDate = new Date();
  targetDate.setHours(0, 0, 0, 0);

  if (dueDateStr.toLowerCase() === 'today') {
    // keep today
  } else if (dueDateStr.toLowerCase() === 'tomorrow') {
    targetDate = addDays(targetDate, 1);
  } else if (dueDateStr.toLowerCase().startsWith('next ')) {
    const dayStr = dueDateStr.split(' ')[1].toLowerCase();
    const dayMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const dayIndex = dayMap[dayStr];
    if (dayIndex !== undefined) {
      targetDate = addDays(nextDay(now, dayIndex as Day), 7);
    }
  } else {
    // Assume MMM d
    const currentYear = now.getFullYear();
    const parsedDate = new Date(`${dueDateStr} ${currentYear}`);
    if (!isNaN(parsedDate.getTime())) {
      targetDate = parsedDate;
      if (targetDate.getTime() < now.getTime() && targetDate.getMonth() < now.getMonth()) {
        targetDate.setFullYear(currentYear + 1);
      }
    }
  }

  // 2. Parse time (e.g. 10:30 AM)
  const timeMatch = dueTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3].toUpperCase();
    
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    targetDate.setHours(hours, minutes, 0, 0);
  }

  // 3. Apply reminder offset
  let triggerDate = targetDate;
  const chipLower = reminderChip.toLowerCase();
  
  // Extract custom offsets dynamically: e.g. "45 min before", "12 hours before", "3 days before"
  const numberMatch = chipLower.match(/(\d+)\s*(min|minute|hr|hour|day)s?\b/);
  if (numberMatch) {
    const value = parseInt(numberMatch[1], 10);
    const unit = numberMatch[2];
    
    if (unit.startsWith('min')) {
      triggerDate = addMinutes(targetDate, -value);
    } else if (unit.startsWith('hr') || unit.startsWith('hour')) {
      triggerDate = addHours(targetDate, -value);
    } else if (unit.startsWith('day')) {
      triggerDate = addDays(targetDate, -value);
    }
  }

  // If trigger date is in the past, don't schedule
  if (triggerDate.getTime() <= Date.now()) return;

  // 4. Create trigger
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerDate.getTime(),
  };

  // 5. Create channel (Android required) with high importance
  const channelId = await notifee.createChannel({
    id: 'task-reminders',
    name: 'Task Reminders',
    sound: 'default',
    importance: 4, // HIGH
    vibration: true,
  });

  // 6. Schedule with fullScreenAction intent config
  await notifee.createTriggerNotification(
    {
      id: taskId,
      title: 'Task Reminder',
      body: title,
      android: {
        channelId,
        category: 'alarm',
        importance: 4, // HIGH
        fullScreenAction: {
          id: 'default',
        },
        pressAction: {
          id: 'default',
        },
        asForegroundService: true, // keeps it active on screen
      },
    },
    trigger,
  );
}

export async function cancelReminder(taskId: string) {
  await notifee.cancelNotification(taskId);
}
