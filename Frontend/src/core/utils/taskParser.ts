import { format, addDays, nextDay, Day } from 'date-fns';

export interface TaskSuggestions {
  tags: string[];
  date: Date | null;
  dateLabel: string | null; // e.g., "Today", "Tomorrow", "Next Monday"
  time: string | null; // e.g., "3:00 PM"
  priority: 'low' | 'medium' | 'high' | null;
}

// ----------------------------------------------------
// Natural Language Dictionaries
// ----------------------------------------------------

const TAG_DICTIONARY: Record<string, string[]> = {
  'Work': [
    'meeting', 'office', 'report', 'presentation', 'client', 'boss', 
    'project', 'deadline', 'review', 'email', 'interview', 'call', 
    'sync', 'standup', 'manager', 'colleague', 'team', 'taskforce', 'work'
  ],
  'Personal': [
    'mom', 'dad', 'family', 'home', 'house', 'dinner', 'lunch', 
    'breakfast', 'friend', 'birthday', 'party', 'kids', 'school',
    'wife', 'husband', 'partner', 'vacation', 'holiday', 'child', 'personal'
  ],
  'Shopping': [
    'buy', 'grocery', 'groceries', 'store', 'mall', 'shop', 
    'market', 'supermarket', 'purchase', 'order', 'shopping'
  ],
  'Fitness & Health': [
    'gym', 'workout', 'run', 'doctor', 'dentist', 'clinic', 
    'hospital', 'medicine', 'pill', 'yoga', 'exercise', 'diet',
    'health', 'checkup', 'physio', 'walk', 'fitness', 'training'
  ],
  'Finance': [
    'bank', 'pay', 'bill', 'transfer', 'tax', 'invoice', 
    'rent', 'mortgage', 'salary', 'credit', 'card', 'budget', 'finance'
  ],
  'Errands': [
    'laundry', 'clean', 'wash', 'car', 'garage', 'repair', 
    'fix', 'plumber', 'electrician', 'mechanic', 'service', 'chores', 'errand'
  ]
};

const PRIORITY_DICTIONARY = {
  high: ['urgent', 'asap', 'critical', 'emergency', 'immediately', 'important', 'highest priority', 'rush'],
  medium: ['soon', 'moderate', 'whenever possible'],
  low: ['later', 'whenever', 'whenever you have time', 'no rush', 'backlog']
};

const DAY_MAP: Record<string, number> = {
  'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
  'thursday': 4, 'friday': 5, 'saturday': 6
};

// ----------------------------------------------------
// Parsing Engine Core
// ----------------------------------------------------

export function parseTaskText(text: string): TaskSuggestions {
  const suggestions: TaskSuggestions = {
    tags: [],
    date: null,
    dateLabel: null,
    time: null,
    priority: null,
  };

  if (!text) return suggestions;

  const lowerText = text.toLowerCase();

  // 1. Parse Tags
  for (const [tag, keywords] of Object.entries(TAG_DICTIONARY)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowerText)) {
        if (!suggestions.tags.includes(tag)) {
          suggestions.tags.push(tag);
        }
        break; // Only add a tag once even if multiple keywords match
      }
    }
  }

  // 2. Parse Priorities
  for (const [priority, keywords] of Object.entries(PRIORITY_DICTIONARY)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(lowerText)) {
        suggestions.priority = priority as any;
        break;
      }
    }
    if (suggestions.priority) break;
  }

  // 3. Parse Time (e.g. "3 pm", "15:00", "6:30am")
  // Matches sizes like 3pm, 3:30 pm, 15:00
  const timeMatch = lowerText.match(/\b((1[0-2]|0?[1-9])(:[0-5][0-9])?\s*(am|pm))|\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/i);
  if (timeMatch) {
    const rawTime = timeMatch[0];
    
    // Normalize time to "9:00 AM" format
    let normalizedHour = 0;
    let normalizedMin = 0;
    let period = 'AM';

    const ampmMatch = rawTime.match(/(am|pm)/i);
    const hasAmPm = !!ampmMatch;
    
    if (hasAmPm) {
      period = ampmMatch[0].toUpperCase();
      const numMatch = rawTime.match(/\b(1[0-2]|0?[1-9])(:([0-5][0-9]))?/);
      if (numMatch) {
        normalizedHour = parseInt(numMatch[1], 10);
        normalizedMin = numMatch[3] ? parseInt(numMatch[3], 10) : 0;
      }
    } else {
      const militaryMatch = rawTime.match(/([01]?[0-9]|2[0-3]):([0-5][0-9])/);
      if (militaryMatch) {
        const h = parseInt(militaryMatch[1], 10);
        normalizedMin = parseInt(militaryMatch[2], 10);
        if (h >= 12) {
          period = 'PM';
          normalizedHour = h > 12 ? h - 12 : 12;
        } else {
          period = 'AM';
          normalizedHour = h === 0 ? 12 : h;
        }
      }
    }
    
    if (normalizedHour > 0) {
      suggestions.time = `${normalizedHour}:${normalizedMin.toString().padStart(2, '0')} ${period}`;
    }
  } else if (lowerText.match(/\b(morning)\b/i)) {
    suggestions.time = "9:00 AM";
  } else if (lowerText.match(/\b(noon)\b/i)) {
    suggestions.time = "12:00 PM";
  } else if (lowerText.match(/\b(evening|tonight)\b/i)) {
    suggestions.time = "6:00 PM";
  } else if (lowerText.match(/\b(night)\b/i)) {
    suggestions.time = "8:00 PM";
  }

  // 4. Parse Date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (lowerText.match(/\b(today|tonight)\b/i)) {
    suggestions.date = today;
    suggestions.dateLabel = "Today";
  } else if (lowerText.match(/\b(day after tomorrow)\b/i)) {
    const targetDate = addDays(today, 2);
    suggestions.date = targetDate;
    suggestions.dateLabel = format(targetDate, 'MMM d');
  } else if (lowerText.match(/\b(tomorrow)\b/i)) {
    suggestions.date = addDays(today, 1);
    suggestions.dateLabel = "Tomorrow";
  } else if (lowerText.match(/\b(next week)\b/i)) {
    suggestions.date = addDays(today, 7);
    suggestions.dateLabel = "Next Week";
  } else if (lowerText.match(/\b(this weekend)\b/i)) {
    const daysToSaturday = (6 - today.getDay() + 7) % 7 || 7;
    const targetDate = addDays(today, daysToSaturday);
    suggestions.date = targetDate;
    suggestions.dateLabel = format(targetDate, 'MMM d');
  } else {
    // Check for "next monday", "on tuesday", etc.
    const dayRegex = /\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
    const dayMatch = lowerText.match(dayRegex);
    if (dayMatch) {
      const isNext = !!dayMatch[1];
      const dayWord = dayMatch[2].toLowerCase();
      const targetDayIndex = DAY_MAP[dayWord] as Day;
      
      if (targetDayIndex !== undefined) {
        let targetDate = nextDay(today, targetDayIndex);
        if (isNext) {
          targetDate = addDays(targetDate, 7);
          suggestions.dateLabel = `Next ${dayWord.charAt(0).toUpperCase() + dayWord.slice(1)}`;
        } else {
          suggestions.dateLabel = format(targetDate, 'MMM d');
        }
        suggestions.date = targetDate;
      }
    }
  }

  return suggestions;
}
