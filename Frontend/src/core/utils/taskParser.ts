import { format, addDays, nextDay, Day, setDate, isBefore, addMonths } from 'date-fns';

export interface TaskSuggestions {
  tags: string[];
  action?: string;
  date: Date | null;
  dateLabel: string | null; // e.g., "Today", "Tomorrow", "Next Monday"
  time: string | null; // e.g., "3:00 PM"
  priority: 'low' | 'medium' | 'high' | null;
  hasReminder?: boolean;
}

// ----------------------------------------------------
// Natural Language Dictionaries
// ----------------------------------------------------

const TAG_DICTIONARY: Record<string, string[]> = {
  'Work': [
    'meeting', 'office', 'report', 'presentation', 'client', 'boss', 
    'project', 'deadline', 'review', 'email', 'interview', 'call', 
    'sync', 'standup', 'manager', 'colleague', 'team', 'taskforce', 'work',
    // Actions
    'submit', 'send', 'prepare'
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
    'health', 'checkup', 'physio', 'walk', 'fitness', 'training', 'appointment'
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

const ACTION_VERBS = ['call', 'buy', 'meet', 'finish', 'submit', 'send', 'review', 'prepare'];

const PRIORITY_DICTIONARY = {
  high: ['urgent', 'asap', 'critical', 'emergency', 'immediately', 'important', 'highest priority', 'rush', 'high priority'],
  medium: ['soon', 'moderate', 'whenever possible'],
  low: ['later', 'whenever', 'whenever you have time', 'no rush', 'backlog', 'low priority']
};

const DAY_MAP: Record<string, number> = {
  'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
  'thursday': 4, 'friday': 5, 'saturday': 6
};

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, 
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, 
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9, 
  nov: 10, november: 10, dec: 11, december: 11
};

// ----------------------------------------------------
// Parsing Engine Core
// ----------------------------------------------------

export function parseTaskText(originalText: string): TaskSuggestions {
  const suggestions: TaskSuggestions = {
    tags: [],
    date: null,
    dateLabel: null,
    time: null,
    priority: null,
    hasReminder: false,
  };

  if (!originalText) return suggestions;

  // 0. Pre-process short/casual language
  let text = originalText.toLowerCase()
    .replace(/\btmrw\b/gi, 'tomorrow')
    .replace(/\bmon\b/gi, 'monday')
    .replace(/\btue\b/gi, 'tuesday')
    .replace(/\btues\b/gi, 'tuesday')
    .replace(/\bwed\b/gi, 'wednesday')
    .replace(/\bthu\b/gi, 'thursday')
    .replace(/\bthurs\b/gi, 'thursday')
    .replace(/\bfri\b/gi, 'friday')
    .replace(/\bsat\b/gi, 'saturday')
    .replace(/\bsun\b/gi, 'sunday')
    .replace(/\beve\b/gi, 'evening')
    .replace(/\baft\b/gi, 'afternoon')
    .replace(/\bnext day\b/gi, 'tomorrow')
    .replace(/\bcoming sunday\b/gi, 'next sunday');

  // 1. Detect Actions and Tags
  for (const [tag, keywords] of Object.entries(TAG_DICTIONARY)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(text)) {
        if (!suggestions.tags.includes(tag)) {
          suggestions.tags.push(tag);
        }
        if (ACTION_VERBS.includes(keyword)) {
          suggestions.action = keyword;
        }
      }
    }
  }

  // Fallback Action detection if not mapped directly in tags
  if (!suggestions.action) {
    for (const verb of ACTION_VERBS) {
      if (new RegExp(`\\b${verb}\\b`, 'i').test(text)) {
        suggestions.action = verb;
        break;
      }
    }
  }

  // 2. Parse Priorities
  const negatedHigh = ['not important', 'not so important', 'not urgent'];
  for (const phrase of negatedHigh) {
    if (text.includes(phrase)) {
      suggestions.priority = 'low';
      break;
    }
  }

  if (!suggestions.priority) {
    for (const [priority, keywords] of Object.entries(PRIORITY_DICTIONARY)) {
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(text)) {
          suggestions.priority = priority as any;
          break;
        }
      }
      if (suggestions.priority) break;
    }
  }

  // 3. Parse Reminder Intent
  const reminderKeywords = ['remind me', "don't forget", 'alert me', 'ping me', 'notify me'];
  for (const phrase of reminderKeywords) {
    if (text.includes(phrase)) {
      suggestions.hasReminder = true;
      break;
    }
  }

  // 4. Parse Time (e.g. "3 pm", "15:00", "6:30am")
  const timeMatch = text.match(/\b((1[0-2]|0?[1-9])(:[0-5][0-9])?\s*(am|pm))|\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b/i);
  if (timeMatch) {
    const rawTime = timeMatch[0];
    
    let normalizedHour = 0;
    let normalizedMin = 0;
    let period = 'AM';

    const ampmMatch = rawTime.match(/(am|pm)/i);
    const hasAmPm = !!ampmMatch;
    
    if (hasAmPm) {
      period = ampmMatch[0].toUpperCase();
      const numMatch = rawTime.match(/(1[0-2]|0?[1-9])(:([0-5][0-9]))?/);
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
  } else if (text.match(/\b(early morning)\b/i)) {
    suggestions.time = "7:00 AM";
  } else if (text.match(/\b(late night|midnight)\b/i)) {
    suggestions.time = "11:00 PM";
  } else if (text.match(/\b(morning)\b/i)) {
    suggestions.time = "9:00 AM";
  } else if (text.match(/\b(noon)\b/i)) {
    suggestions.time = "12:00 PM";
  } else if (text.match(/\b(afternoon)\b/i)) {
    suggestions.time = "2:00 PM";
  } else if (text.match(/\b(evening|tonight)\b/i)) {
    suggestions.time = "6:00 PM";
  } else if (text.match(/\b(night)\b/i)) {
    suggestions.time = "8:00 PM";
  }

  // 5. Parse Date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Exact Match: Day Month (e.g. 5 april, 5th april)
  const dayMonthMatch = text.match(/\b(\d{1,2})(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i);
  // Exact Match: Month Day (e.g. april 5, april 5th)
  const monthDayMatch = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(st|nd|rd|th)?\b/i);
  // Match just an ordinal (on 5th, 5th evening)
  const ordinalMatch = text.match(/\b(on\s+)?(\d{1,2})(st|nd|rd|th)\b/i);
  
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const monthStr = dayMonthMatch[3].toLowerCase();
    const month = MONTH_MAP[monthStr];
    handleExactDate(today, day, month, suggestions);
  } else if (monthDayMatch) {
    const monthStr = monthDayMatch[1].toLowerCase();
    const day = parseInt(monthDayMatch[2], 10);
    const month = MONTH_MAP[monthStr];
    handleExactDate(today, day, month, suggestions);
  } else if (text.match(/\b(\d{1,2})\/(\d{1,2})(\/\d{2,4})?\b/)) {
    const slashes = text.match(/\b(\d{1,2})\/(\d{1,2})(\/\d{2,4})?\b/);
    if (slashes) {
      // Assuming DD/MM
      const day = parseInt(slashes[1], 10);
      const month = parseInt(slashes[2], 10) - 1; // 0-indexed
      handleExactDate(today, day, month, suggestions);
    }
  } else if (ordinalMatch && !text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i)) {
    const day = parseInt(ordinalMatch[2], 10);
    let targetDate = setDate(today, day);
    if (isBefore(targetDate, today)) {
       targetDate = addMonths(targetDate, 1);
    }
    suggestions.date = targetDate;
    suggestions.dateLabel = format(targetDate, 'MMM d');
  } else if (text.match(/\b(today|tonight)\b/i)) {
    suggestions.date = today;
    suggestions.dateLabel = "Today";
  } else if (text.match(/\b(day after( )?(tomorrow|tommorrow|tommorow|tomorow))\b/i)) {
    const targetDate = addDays(today, 2);
    suggestions.date = targetDate;
    suggestions.dateLabel = format(targetDate, 'MMM d');
  } else if (text.match(/\b(tomorrow|tommorrow|tommorow|tomorow)\b/i)) {
    suggestions.date = addDays(today, 1);
    suggestions.dateLabel = "Tomorrow";
  } else if (text.match(/\b(next week)\b/i)) {
    suggestions.date = addDays(today, 7);
    suggestions.dateLabel = "Next Week";
  } else if (text.match(/\b(this weekend|weekend|next weekend)\b/i)) {
    const daysToSaturday = (6 - today.getDay() + 7) % 7 || 7;
    const targetDate = addDays(today, text.match(/next weekend/i) ? daysToSaturday + 7 : daysToSaturday);
    suggestions.date = targetDate;
    suggestions.dateLabel = format(targetDate, 'MMM d');
  } else {
    // Check for "next monday", "on tuesday", etc.
    const dayRegex = /\b(next\s+|this\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
    const dayMatch = text.match(dayRegex);
    if (dayMatch) {
      const modifier = dayMatch[1]?.trim().toLowerCase(); // "next" or "this"
      const dayWord = dayMatch[2].toLowerCase();
      const targetDayIndex = DAY_MAP[dayWord] as Day;
      
      if (targetDayIndex !== undefined) {
        let targetDate = nextDay(today, targetDayIndex);
        if (modifier === 'next') {
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

function handleExactDate(today: Date, targetDay: number, targetMonth: number, suggestions: TaskSuggestions) {
  let targetDate = new Date(today.getFullYear(), targetMonth, targetDay);
  if (isBefore(targetDate, today) && targetMonth < today.getMonth()) {
    // If date has passed and month is earlier in the year, assume next year
    targetDate.setFullYear(today.getFullYear() + 1);
  }
  suggestions.date = targetDate;
  suggestions.dateLabel = format(targetDate, 'MMM d');
}
