/**
 * dashboardPrefsStore — persists user dashboard preferences (active view mode,
 * default launch view, widget visibility toggles, widget ordering, and layout density)
 * using expo-file-system/legacy.
 */
import * as FileSystem from 'expo-file-system/legacy';

export type DashboardViewMode = 'bento' | 'focus' | 'studio' | 'minimal';
export type DisplayDensity = 'compact' | 'comfortable' | 'expanded';

export type BentoWidgetKey = 'statusBar' | 'heroCard' | 'bentoGrid' | 'recentSketches' | 'upcoming';
export type FocusWidgetKey = 'weekCalendar' | 'progressBar' | 'quickComposer' | 'agenda';
export type StudioWidgetKey = 'ideationBar' | 'filterPills' | 'creativeFeed' | 'taskRadar';
export type MinimalWidgetKey = 'calmHeader' | 'recentsCarousel' | 'ruleOfThree' | 'microDock';

export interface ViewWidgetVisibility {
  bento: Record<BentoWidgetKey, boolean>;
  focus: Record<FocusWidgetKey, boolean>;
  studio: Record<StudioWidgetKey, boolean>;
  minimal: Record<MinimalWidgetKey, boolean>;
}

export interface ViewWidgetOrder {
  bento: BentoWidgetKey[];
  focus: FocusWidgetKey[];
  studio: StudioWidgetKey[];
  minimal: MinimalWidgetKey[];
}

export interface DashboardPreferences {
  activeViewMode: DashboardViewMode;
  defaultViewMode: DashboardViewMode;
  density: DisplayDensity;
  enableSwipePager: boolean;
  widgetVisibility: ViewWidgetVisibility;
  widgetOrder: ViewWidgetOrder;
}

export const DEFAULT_WIDGET_ORDER: ViewWidgetOrder = {
  bento: ['statusBar', 'heroCard', 'bentoGrid', 'recentSketches', 'upcoming'],
  focus: ['weekCalendar', 'progressBar', 'quickComposer', 'agenda'],
  studio: ['ideationBar', 'filterPills', 'creativeFeed', 'taskRadar'],
  minimal: ['calmHeader', 'recentsCarousel', 'ruleOfThree', 'microDock'],
};

export const DEFAULT_WIDGET_VISIBILITY: ViewWidgetVisibility = {
  bento: {
    statusBar: true,
    heroCard: true,
    bentoGrid: true,
    recentSketches: true,
    upcoming: true,
  },
  focus: {
    weekCalendar: true,
    progressBar: true,
    quickComposer: true,
    agenda: true,
  },
  studio: {
    ideationBar: true,
    filterPills: true,
    creativeFeed: true,
    taskRadar: true,
  },
  minimal: {
    calmHeader: true,
    recentsCarousel: true,
    ruleOfThree: true,
    microDock: true,
  },
};

export const DEFAULT_PREFERENCES: DashboardPreferences = {
  activeViewMode: 'bento',
  defaultViewMode: 'bento',
  density: 'comfortable',
  enableSwipePager: false,
  widgetVisibility: DEFAULT_WIDGET_VISIBILITY,
  widgetOrder: DEFAULT_WIDGET_ORDER,
};

const PREFS_FILE = `${FileSystem.documentDirectory}dashboard_preferences.json`;

/**
 * Read dashboard preferences from file system. Falls back to default if file doesn't exist or is corrupted.
 */
export async function getDashboardPreferences(): Promise<DashboardPreferences> {
  try {
    const info = await FileSystem.getInfoAsync(PREFS_FILE);
    if (!info.exists) {
      return { ...DEFAULT_PREFERENCES };
    }
    const raw = await FileSystem.readAsStringAsync(PREFS_FILE);
    const parsed = JSON.parse(raw) as Partial<DashboardPreferences>;
    
    // Deep merge with defaults to safeguard against missing keys
    return {
      activeViewMode: parsed.activeViewMode || DEFAULT_PREFERENCES.activeViewMode,
      defaultViewMode: parsed.defaultViewMode || DEFAULT_PREFERENCES.defaultViewMode,
      density: parsed.density || DEFAULT_PREFERENCES.density,
      enableSwipePager: parsed.enableSwipePager !== undefined ? parsed.enableSwipePager : DEFAULT_PREFERENCES.enableSwipePager,
      widgetVisibility: {
        bento: {
          ...DEFAULT_PREFERENCES.widgetVisibility.bento,
          ...(parsed.widgetVisibility?.bento || {}),
        },
        focus: {
          ...DEFAULT_PREFERENCES.widgetVisibility.focus,
          ...(parsed.widgetVisibility?.focus || {}),
        },
        studio: {
          ...DEFAULT_PREFERENCES.widgetVisibility.studio,
          ...(parsed.widgetVisibility?.studio || {}),
        },
        minimal: {
          ...DEFAULT_PREFERENCES.widgetVisibility.minimal,
          ...(parsed.widgetVisibility?.minimal || {}),
        },
      },
      widgetOrder: {
        bento: parsed.widgetOrder?.bento && Array.isArray(parsed.widgetOrder.bento) && parsed.widgetOrder.bento.length > 0
          ? parsed.widgetOrder.bento
          : [...DEFAULT_PREFERENCES.widgetOrder.bento],
        focus: parsed.widgetOrder?.focus && Array.isArray(parsed.widgetOrder.focus) && parsed.widgetOrder.focus.length > 0
          ? parsed.widgetOrder.focus
          : [...DEFAULT_PREFERENCES.widgetOrder.focus],
        studio: parsed.widgetOrder?.studio && Array.isArray(parsed.widgetOrder.studio) && parsed.widgetOrder.studio.length > 0
          ? parsed.widgetOrder.studio
          : [...DEFAULT_PREFERENCES.widgetOrder.studio],
        minimal: parsed.widgetOrder?.minimal && Array.isArray(parsed.widgetOrder.minimal) && parsed.widgetOrder.minimal.length > 0
          ? parsed.widgetOrder.minimal
          : [...DEFAULT_PREFERENCES.widgetOrder.minimal],
      },
    };
  } catch (err) {
    console.warn('[dashboardPrefsStore] Failed to read preferences, using defaults:', err);
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Write dashboard preferences to file system.
 */
export async function saveDashboardPreferences(prefs: DashboardPreferences): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(PREFS_FILE, JSON.stringify(prefs, null, 2));
  } catch (err) {
    console.error('[dashboardPrefsStore] Failed to save preferences:', err);
  }
}

/**
 * Update the active view mode and persist.
 */
export async function updateActiveViewMode(mode: DashboardViewMode): Promise<DashboardPreferences> {
  const current = await getDashboardPreferences();
  const updated: DashboardPreferences = { ...current, activeViewMode: mode };
  await saveDashboardPreferences(updated);
  return updated;
}

/**
 * Update the default view mode and persist.
 */
export async function updateDefaultViewMode(mode: DashboardViewMode): Promise<DashboardPreferences> {
  const current = await getDashboardPreferences();
  const updated: DashboardPreferences = { ...current, defaultViewMode: mode };
  await saveDashboardPreferences(updated);
  return updated;
}

/**
 * Update display density and persist.
 */
export async function updateDisplayDensity(density: DisplayDensity): Promise<DashboardPreferences> {
  const current = await getDashboardPreferences();
  const updated: DashboardPreferences = { ...current, density };
  await saveDashboardPreferences(updated);
  return updated;
}

/**
 * Update swipe pager setting and persist.
 */
export async function updateSwipePager(enable: boolean): Promise<DashboardPreferences> {
  const current = await getDashboardPreferences();
  const updated: DashboardPreferences = { ...current, enableSwipePager: enable };
  await saveDashboardPreferences(updated);
  return updated;
}

/**
 * Toggle or set widget visibility for a specific view mode and persist.
 */
export async function updateWidgetVisibility<V extends DashboardViewMode>(
  view: V,
  widgetKey: keyof ViewWidgetVisibility[V],
  visible: boolean
): Promise<DashboardPreferences> {
  const current = await getDashboardPreferences();
  const updated: DashboardPreferences = {
    ...current,
    widgetVisibility: {
      ...current.widgetVisibility,
      [view]: {
        ...current.widgetVisibility[view],
        [widgetKey]: visible,
      },
    },
  };
  await saveDashboardPreferences(updated);
  return updated;
}

/**
 * Update widget order for a specific view mode and persist.
 */
export async function updateWidgetOrder<V extends DashboardViewMode>(
  view: V,
  order: ViewWidgetOrder[V]
): Promise<DashboardPreferences> {
  const current = await getDashboardPreferences();
  const updated: DashboardPreferences = {
    ...current,
    widgetOrder: {
      ...current.widgetOrder,
      [view]: order,
    },
  };
  await saveDashboardPreferences(updated);
  return updated;
}

/**
 * Reset all preferences to initial defaults.
 */
export async function resetDashboardPreferences(): Promise<DashboardPreferences> {
  await saveDashboardPreferences(DEFAULT_PREFERENCES);
  return { ...DEFAULT_PREFERENCES };
}
