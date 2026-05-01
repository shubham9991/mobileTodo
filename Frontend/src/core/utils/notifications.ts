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
  
  if (chipLower.includes('5 min before')) triggerDate = addMinutes(targetDate, -5);
  else if (chipLower.includes('15 min before')) triggerDate = addMinutes(targetDate, -15);
  else if (chipLower.includes('30 min before')) triggerDate = addMinutes(targetDate, -30);
  else if (chipLower.includes('1 hr before')) triggerDate = addHours(targetDate, -1);
  else if (chipLower.includes('2 hrs before')) triggerDate = addHours(targetDate, -2);
  else if (chipLower.includes('1 day before')) triggerDate = addDays(targetDate, -1);

  // If trigger date is in the past, don't schedule
  if (triggerDate.getTime() <= Date.now()) return;

  // 4. Create trigger
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: triggerDate.getTime(),
  };

  // 5. Create channel (Android required)
  const channelId = await notifee.createChannel({
    id: 'task-reminders',
    name: 'Task Reminders',
    sound: 'default',
  });

  // 6. Schedule
  await notifee.createTriggerNotification(
    {
      id: taskId,
      title: 'Task Reminder',
      body: title,
      android: {
        channelId,
        pressAction: {
          id: 'default',
        },
      },
    },
    trigger,
  );
}

export async function cancelReminder(taskId: string) {
  await notifee.cancelNotification(taskId);
}
