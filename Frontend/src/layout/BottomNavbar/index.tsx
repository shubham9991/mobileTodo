import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable,
  TextInput,
  ScrollView,
  Animated as RNAnimated,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { useManage, DockItem } from '../../core/ManageContext';
import { TaskComposer } from '../../core/components/TaskComposer';
import { useDashboard } from '../../core/DashboardContext';

const { height: SCREEN_H } = Dimensions.get('window');

const ROW_H     = 58;
const GRABBER_H = 20;
const PANEL_H   = ROW_H + GRABBER_H; // total expandable height for 2-row

const SNAP_SPRING  = { mass: 0.45, damping: 16, stiffness: 260 };
const CLOSE_SPRING = { mass: 0.55, damping: 18, stiffness: 220 };

// ── Haptic helpers outside component so runOnJS gets a stable reference ────────
const hapticMed   = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

// ─── TabButton ─────────────────────────────────────────────────────────────────
const TabButton = React.memo((
  { item, isActive, onPress, theme, compact = true, drawerMode = false }:
  { item: DockItem; isActive: boolean; onPress: () => void; theme: any; compact?: boolean; drawerMode?: boolean }
) => {
  const scale = useRef(new RNAnimated.Value(isActive ? 1.08 : 1.0)).current;

  useEffect(() => {
    RNAnimated.spring(scale, {
      toValue: isActive ? 1.08 : 1.0,
      tension: 180, friction: 12, useNativeDriver: true,
    }).start();
  }, [isActive]);

  const color = isActive ? theme.colors.primary : theme.colors.textSecondary;

  // drawerMode: compact tile style but 25% wide (4 per row in fullscreen drawer)
  const tileStyle = drawerMode ? styles.fsDrawerItem : compact ? styles.navItem : styles.gridItem;
  const iconWrapStyle = drawerMode
    ? styles.iconWrap
    : compact ? styles.iconWrap : [styles.gridIconBg, { backgroundColor: `${color}18`, borderRadius: 16 } as any];
  const iconSize  = (drawerMode || compact) ? 24 : 28;
  const labelStyle = (drawerMode || compact) ? styles.label : styles.gridLabel;

  return (
    <TouchableOpacity style={tileStyle} onPress={onPress} activeOpacity={0.7}>
      <RNAnimated.View style={[iconWrapStyle, { transform: [{ scale }] }]}>
        <MaterialIcons name={item.icon as any} size={iconSize} color={color} />
      </RNAnimated.View>
      <Text numberOfLines={1} style={[labelStyle, { color, fontFamily: 'Inter_500Medium' }]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
});

// ─── NavOption for FAB Speed Dial ─────────────────────────────────────────────
const NavOption = React.memo(({
  item,
  openProgress,
  onPress,
  theme,
}: {
  item: any;
  openProgress: SharedValue<number>;
  onPress: () => void;
  theme: any;
}) => {
  const animStyle = useAnimatedStyle(() => {
    const translateY = interpolate(openProgress.value, [0, 1], [40, 0]);
    const opacity = interpolate(openProgress.value, [0, 0.5, 1], [0, 0, 1]);
    return {
      transform: [{ translateY }],
      opacity,
    };
  });

  return (
    <Animated.View style={[styles.optionRow, animStyle]}>
      <TouchableOpacity
        style={[
          styles.optionLabelWrap,
          {
            backgroundColor: theme.colors.cardPrimary,
            borderColor: theme.colors.border,
          },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
          {item.label}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.optionBtn,
          { backgroundColor: item.color || theme.colors.primary },
        ]}
        onPress={onPress}
      >
        <MaterialIcons name={item.icon as any} size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── BottomNavbar ──────────────────────────────────────────────────────────────
export const BottomNavbar = () => {
  const { theme, isDark } = useTheme();
  const {
    dockMode, dockItems,
    isDockExpanded, setIsDockExpanded, hideDock,
  } = useManage();
  const { handleComposerSave } = useDashboard();
  const router    = useRouter();
  const pathname  = usePathname();
  const insets    = useSafeAreaInsets();
  const [showTask, setShowTask] = useState(false);
  const isCompact    = dockMode === 'compact';
  const is2Row       = dockMode === 'expanded-2row';
  const isFullscreen = dockMode === 'fullscreen';
  const bottomPad    = insets.bottom + 12;

  const row1 = dockItems.slice(0, 4);
  const row2 = dockItems.slice(4, 8);

  // ── Shared values ─────────────────────────────────────────────────────────
  const progress  = useSharedValue(0);   // 2-row: 0=closed 1=open
  const startProg = useSharedValue(0);
  const fsY       = useSharedValue(SCREEN_H); // fullscreen: SCREEN_H=closed 0=open
  const fsStartY  = useSharedValue(0);

  // Shared value: controls whether FS overlay is mounted
  const [fsOpen, setFsOpen] = useState(false);

  // ── Fullscreen dock: search & sort (local to panel, never mutates dockItems) ─
  const [fsSearchQuery, setFsSearchQuery]   = useState('');
  const [fsSortMode,    setFsSortMode]      = useState<'default' | 'az' | 'za'>('default');
  const [showFsSortMenu, setShowFsSortMenu] = useState(false);

  const fsDisplayItems = useMemo(() => {
    // Exclude the first 4 pinned items (row1) from the scrollable grid to prevent duplicate rendering
    let items = dockItems.slice(4);
    if (fsSortMode === 'az') items.sort((a, b) => a.label.localeCompare(b.label));
    if (fsSortMode === 'za') items.sort((a, b) => b.label.localeCompare(a.label));
    const q = fsSearchQuery.trim().toLowerCase();
    if (q) items = items.filter(i => i.label.toLowerCase().includes(q));
    return items;
  }, [dockItems, fsSortMode, fsSearchQuery]);

  // ─── FAB Navigation Menu (When hideDock is true) ──────────────────────────────
  const [navFABOpen, setNavFABOpen] = useState(false);
  const [tempDockMounted, setTempDockMounted] = useState(false);
  const rotation = useSharedValue(0);
  const backdropOp = useSharedValue(0);
  const openProgress = useSharedValue(0);
  const tempDockY = useSharedValue(150);

  const openTempDock = useCallback(() => {
    setTempDockMounted(true);
    tempDockY.value = withSpring(0, SNAP_SPRING);
  }, [tempDockY]);

  const closeTempDock = useCallback(() => {
    hapticLight();
    tempDockY.value = withSpring(150, CLOSE_SPRING, (done) => {
      if (done) {
        runOnJS(setTempDockMounted)(false);
      }
    });
  }, [tempDockY]);

  const toggleFAB = useCallback(() => {
    if (navFABOpen) {
      rotation.value = withTiming(0, { duration: 200 });
      backdropOp.value = withTiming(0, { duration: 200 });
      openProgress.value = withTiming(0, { duration: 180 });
    } else {
      rotation.value = withTiming(45, { duration: 200 });
      backdropOp.value = withTiming(1, { duration: 200 });
      openProgress.value = withSpring(1, { damping: 15, stiffness: 200 });
    }
    setNavFABOpen(prev => !prev);
  }, [navFABOpen, rotation, backdropOp, openProgress]);

  const animFABRotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const animBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  // Sync animations when isDockExpanded changes
  useEffect(() => {
    if (!isDockExpanded) {
      progress.value = withSpring(0, CLOSE_SPRING);
      fsY.value = withSpring(SCREEN_H, CLOSE_SPRING, (done) => {
        if (done) runOnJS(setFsOpen)(false);
      });
    } else {
      if (is2Row) {
        progress.value = withSpring(1, SNAP_SPRING);
      } else if (isFullscreen) {
        setFsOpen(true);
        fsY.value = withSpring(0, SNAP_SPRING);
      }
    }
  }, [isDockExpanded, is2Row, isFullscreen, progress, fsY]);

  // Reset on mode or route change
  useEffect(() => {
    progress.value = 0;
    fsY.value = SCREEN_H;
    setFsOpen(false);
    setIsDockExpanded(false);
    setTempDockMounted(false);
    tempDockY.value = 150;
  }, [dockMode, pathname, setIsDockExpanded, progress, fsY, tempDockY]);

  // Reset fullscreen search/sort when panel closes
  useEffect(() => {
    if (!fsOpen) {
      setFsSearchQuery('');
      setShowFsSortMenu(false);
    }
  }, [fsOpen]);

  const closeDock = useCallback(() => {
    hapticLight();
    setIsDockExpanded(false);
  }, [setIsDockExpanded]);

  const onTabPress = useCallback((item: DockItem) => {
    hapticLight();
    progress.value = 0;
    fsY.value = SCREEN_H;
    setFsOpen(false);
    setIsDockExpanded(false);
    tempDockY.value = withSpring(150, CLOSE_SPRING, (done) => {
      if (done) {
        runOnJS(setTempDockMounted)(false);
      }
    });
    router.push(item.route as any);
  }, [progress, fsY, setIsDockExpanded, router, tempDockY]);

  // ── Active check ──────────────────────────────────────────────────────────
  const isActiveItem = (item: DockItem) =>
    item.match === '/'
      ? pathname === '/' || pathname === '/index'
      : pathname.startsWith(item.match);

  // ── Gestures ──────────────────────────────────────────────────────────────
  const twoRowGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      runOnJS(setIsDockExpanded)(true);
      startProg.value = progress.value;
    })
    .onUpdate((e) => {
      if (hideDock && e.translationY > 0 && progress.value === 0) {
        tempDockY.value = e.translationY;
      } else {
        const delta = -e.translationY / PANEL_H;
        progress.value = Math.min(1, Math.max(0, startProg.value + delta));
      }
    })
    .onEnd((e) => {
      if (hideDock && tempDockY.value > 0) {
        const flingDown = e.velocityY > 300;
        const dragDown = tempDockY.value > 45;
        if (flingDown || dragDown) {
          tempDockY.value = withSpring(150, CLOSE_SPRING, (done) => {
            if (done) runOnJS(setTempDockMounted)(false);
          });
          runOnJS(hapticLight)();
        } else {
          tempDockY.value = withSpring(0, SNAP_SPRING);
        }
      } else {
        const flingUp   = e.velocityY < -400;
        const flingDown = e.velocityY >  400;
        const isOpen    = progress.value > 0.4;
        if (flingUp || (!flingDown && isOpen)) {
          progress.value = withSpring(1, SNAP_SPRING);
          runOnJS(hapticMed)();
        } else {
          progress.value = withSpring(0, CLOSE_SPRING);
          runOnJS(setIsDockExpanded)(false);
          runOnJS(hapticLight)();
          if (hideDock) {
            tempDockY.value = withSpring(150, CLOSE_SPRING, (done) => {
              if (done) runOnJS(setTempDockMounted)(false);
            });
          }
        }
      }
    });

  const fsOpenGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      // Mount the fullscreen panel immediately so it's visible on the first frame of the swipe
      runOnJS(setFsOpen)(true);
      runOnJS(setIsDockExpanded)(true);
      fsStartY.value = fsY.value;
    })
    .onUpdate((e) => {
      if (hideDock && e.translationY > 0 && fsY.value === SCREEN_H) {
        tempDockY.value = e.translationY;
      } else {
        fsY.value = Math.max(0, Math.min(SCREEN_H, fsStartY.value + e.translationY));
      }
    })
    .onEnd((e) => {
      if (hideDock && tempDockY.value > 0) {
        const flingDown = e.velocityY > 300;
        const dragDown = tempDockY.value > 45;
        if (flingDown || dragDown) {
          tempDockY.value = withSpring(150, CLOSE_SPRING, (done) => {
            if (done) runOnJS(setTempDockMounted)(false);
          });
          runOnJS(hapticLight)();
        } else {
          tempDockY.value = withSpring(0, SNAP_SPRING);
        }
      } else {
        const flingUp   = e.velocityY < -400;
        const flingDown = e.velocityY >  400;
        const dragPct   = fsY.value / SCREEN_H;
        if (flingUp || (!flingDown && dragPct < 0.6)) {
          fsY.value = withSpring(0, SNAP_SPRING);
          runOnJS(hapticMed)();
        } else {
          fsY.value = withSpring(SCREEN_H, CLOSE_SPRING);
          runOnJS(setIsDockExpanded)(false);
          runOnJS(hapticLight)();
          if (hideDock) {
            tempDockY.value = withSpring(150, CLOSE_SPRING, (done) => {
              if (done) runOnJS(setTempDockMounted)(false);
            });
          }
        }
      }
    });

  const tempDockGesture = Gesture.Pan()
    .activeOffsetY([0, 8])
    .onUpdate((e) => {
      tempDockY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const flingDown = e.velocityY > 300;
      const dragDown = tempDockY.value > 45;
      if (flingDown || dragDown) {
        tempDockY.value = withSpring(150, CLOSE_SPRING, (done) => {
          if (done) runOnJS(setTempDockMounted)(false);
        });
        runOnJS(hapticLight)();
      } else {
        tempDockY.value = withSpring(0, SNAP_SPRING);
      }
    });

  const fsGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      fsStartY.value = fsY.value;
    })
    .onUpdate((e) => {
      fsY.value = Math.max(0, Math.min(SCREEN_H, fsStartY.value + e.translationY));
    })
    .onEnd((e) => {
      const flingDown = e.velocityY > 400;
      const dragPct   = fsY.value / SCREEN_H;
      if (!flingDown && dragPct < 0.6) {
        fsY.value = withSpring(0, SNAP_SPRING);
      } else {
        runOnJS(hapticLight)();
        fsY.value = withSpring(SCREEN_H, CLOSE_SPRING, (done) => {
          if (done) {
            runOnJS(setFsOpen)(false);
            runOnJS(setIsDockExpanded)(false);
          }
        });
      }
    });

  // Unified gesture: handles both swipe-up (open) and swipe-down (close) on the growing panel
  const fsExpandGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      runOnJS(setFsOpen)(true);
      runOnJS(setIsDockExpanded)(true);
      fsStartY.value = fsY.value;
    })
    .onUpdate((e) => {
      fsY.value = Math.max(0, Math.min(SCREEN_H, fsStartY.value + e.translationY));
    })
    .onEnd((e) => {
      const flingUp   = e.velocityY < -400;
      const flingDown = e.velocityY >  400;
      const dragPct   = fsY.value / SCREEN_H;
      if (flingUp || (!flingDown && dragPct < 0.5)) {
        fsY.value = withSpring(0, SNAP_SPRING);
        runOnJS(hapticMed)();
      } else {
        runOnJS(hapticLight)();
        fsY.value = withSpring(SCREEN_H, CLOSE_SPRING, (done) => {
          if (done) {
            runOnJS(setFsOpen)(false);
            runOnJS(setIsDockExpanded)(false);
          }
        });
      }
    });

  // ── Animated styles ───────────────────────────────────────────────────────
  const animRow2 = useAnimatedStyle(() => ({
    height:   interpolate(progress.value, [0, 1], [0, ROW_H], Extrapolation.CLAMP),
    opacity:  interpolate(progress.value, [0, 0.3, 1], [0, 0.5, 1], Extrapolation.CLAMP),
    overflow: 'hidden' as const,
  }));

  const animGrabber = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(progress.value, [0, 1], [1, 0.6]) }],
    opacity:   interpolate(progress.value, [0, 1], [1, 0.4]),
  }));

  const dockBgColor = theme.colors.background;

  const animTempDockStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tempDockY.value }],
  }));

  // fsPanel grows upward from dock-bar height to full screen — pinned at bottom
  const DOCK_BAR_H = GRABBER_H + ROW_H + bottomPad;
  const animFsPanel = useAnimatedStyle(() => {
    const height = interpolate(fsY.value, [SCREEN_H, 0], [DOCK_BAR_H, SCREEN_H], Extrapolation.CLAMP);
    const paddingTop = interpolate(fsY.value, [SCREEN_H, 0], [0, insets.top], Extrapolation.CLAMP);
    return {
      height,
      paddingTop,
    };
  });

  // Header reveals by expanding downward only when drawer is nearly fully open
  const FS_HEADER_H = 76;
  const animFsHeader = useAnimatedStyle(() => {
    const p = interpolate(fsY.value, [SCREEN_H * 0.4, 0], [0, 1], Extrapolation.CLAMP);
    return {
      height:   interpolate(p, [0, 1], [0, FS_HEADER_H]),
      opacity:  p,
      overflow: 'hidden' as const,
    };
  });

  const animFabStackStyle = useAnimatedStyle(() => {
    const baseShift = interpolate(tempDockY.value, [150, 0], [0, -76], Extrapolation.CLAMP);
    const expandShift = interpolate(progress.value, [0, 1], [0, -ROW_H], Extrapolation.CLAMP);
    const opacity = interpolate(fsY.value, [SCREEN_H, SCREEN_H - 100], [1, 0], Extrapolation.CLAMP);
    return {
      transform: [{ translateY: baseShift + expandShift }],
      opacity,
    };
  });

  // ── Dock content (shared between wrapped/unwrapped render) ────────────────
  const dockContent = (
    <Animated.View style={[
      styles.dock,
      {
        backgroundColor: dockBgColor,
        borderTopColor: theme.colors.border,
        paddingBottom: bottomPad,
        zIndex: 99,
      },
      hideDock && {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
      },
      hideDock && animTempDockStyle
    ]}>
      {/* Grabber pill */}
      {!isCompact && (
        <View style={styles.grabberArea}>
          <Animated.View style={is2Row ? animGrabber : undefined}>
            <View style={[styles.grabberPill, { backgroundColor: theme.colors.border }]} />
          </Animated.View>
        </View>
      )}

      {/* Row 1 — always visible, slides up as Row 2 expands below */}
      <View style={styles.row}>
        {row1.map(item => (
          <TabButton key={item.id} item={item} isActive={isActiveItem(item)}
            onPress={() => onTabPress(item)} theme={theme} />
        ))}
      </View>

      {/* Row 2 — height-animated, reveals below Row 1 */}
      {is2Row && (
        <Animated.View style={animRow2}>
          {row2.length > 0 ? (
            <View style={[styles.row, { paddingVertical: 8 }]}>
              {row2.map(item => (
                <TabButton key={item.id} item={item} isActive={isActiveItem(item)}
                  onPress={() => onTabPress(item)} theme={theme} />
              ))}
              {row2.length < 4 && Array.from({ length: 4 - row2.length }).map((_, i) => (
                <View key={`sp-${i}`} style={styles.navItem} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyRow}>
              <MaterialIcons name="add-circle-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTxt, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                Add shortcuts in Manage → Dock
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </Animated.View>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const quickActions = [
    {
      id: 'quick-note',
      label: 'New Note',
      icon: 'description',
      color: '#F97316',
      onPress: () => {
        toggleFAB();
        const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setTimeout(() => router.push({ pathname: '/note', params: { noteId: id } }), 250);
      }
    },
    {
      id: 'quick-task',
      label: 'New Task',
      icon: 'task-alt',
      color: '#6366F1',
      onPress: () => {
        toggleFAB();
        setTimeout(() => setShowTask(true), 250);
      }
    },
    {
      id: 'quick-sketch',
      label: 'New Sketch',
      icon: 'brush',
      color: '#10B981',
      onPress: () => {
        toggleFAB();
        const id = `drawing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        setTimeout(() => router.push({ pathname: '/drawing', params: { drawingId: id, drawingTitle: '' } }), 250);
      }
    },
    ...(hideDock ? [{
      id: 'open-dock',
      label: 'Open Dock',
      icon: 'widgets',
      color: theme.colors.primary,
      onPress: () => {
        toggleFAB();
        setTimeout(() => openTempDock(), 250);
      }
    }] : [])
  ];

  return (
    <>
      {/* ── Temp dock overlay (only when hideDock=true) ───────────────────────── */}
      {hideDock && tempDockMounted && (
        <>
          {/* Transparent backdrop — tap outside dock to close it */}
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 85 }]}
            onPress={closeTempDock}
          />
          <GestureDetector gesture={
            is2Row ? twoRowGesture : isFullscreen ? fsOpenGesture : tempDockGesture
          }>
            {dockContent}
          </GestureDetector>
        </>
      )}



      {/* ── Normal dock ──────────────────────────────────────────────── */}
      {!hideDock && (
        is2Row ? (
          <GestureDetector gesture={twoRowGesture}>{dockContent}</GestureDetector>
        ) : isFullscreen ? (
          // In fullscreen mode the expanding panel is position:absolute below;
          // render a same-height spacer so the page content keeps its bottom margin.
          <View style={{ height: DOCK_BAR_H, width: '100%' }} />
        ) : (
          dockContent
        )
      )}

      {/* ── FAB and Overlays ──────────────────────────────────────────────────── */}
      {navFABOpen && (
        <Animated.View style={[styles.backdrop, animBackdropStyle, { zIndex: 190 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={toggleFAB} />
        </Animated.View>
      )}

      {/* Global Dynamic FAB Menu */}
      <Animated.View
        style={[
          styles.fabStack,
          {
            bottom: hideDock ? insets.bottom + 16 : insets.bottom + 16 + 76,
            zIndex: 200,
          },
          animFabStackStyle,
        ]}
        pointerEvents="box-none"
      >
        {/* Speed-dial options — only rendered when the FAB menu is open */}
        {navFABOpen && quickActions.map((item) => (
          <NavOption key={item.id} item={item} openProgress={openProgress} onPress={item.onPress} theme={theme} />
        ))}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          onPress={() => {
            if (hideDock && tempDockMounted) {
              // Dock is open — close it, reset FAB rotation
              if (navFABOpen) toggleFAB();
              closeTempDock();
            } else {
              toggleFAB();
            }
          }}
          activeOpacity={0.85}
        >
          <Animated.View style={animFABRotateStyle}>
            <MaterialIcons name="add" size={26} color="#FFFFFF" />
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {/* \u2500\u2500 Fullscreen growing dock panel \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
           Pinned at the bottom, grows upward from dock-bar height to full screen.
           The compact Row1 always sits at the bottom (= the original dock).
           Extra tiles + search header reveal above as the panel expands.
       \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
      {isFullscreen && !hideDock && (
        <>
          {/* Tap-above-panel backdrop — only visible when panel is expanded */}
          {fsOpen && (
            <Pressable
              style={[StyleSheet.absoluteFill, { zIndex: 97 }]}
              onPress={() => { setShowFsSortMenu(false); closeDock(); }}
            />
          )}

          <GestureDetector gesture={fsExpandGesture}>
            <Animated.View style={[
              {
                position: 'absolute' as const,
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: theme.colors.background,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.colors.border,
                overflow: 'hidden' as const,
                zIndex: 99,
              },
              animFsPanel,
            ]}>
              {/* Grabber \u2014 always at the top of the expanding panel */}
              <View style={styles.grabberArea}>
                <View style={[styles.grabberPill, { backgroundColor: theme.colors.border }]} />
              </View>

              {/* Search + Sort header \u2014 reveals only when drawer is nearly fully open */}
              <Animated.View style={animFsHeader}>
                <View style={styles.fsHeader}>
                  <View style={[styles.fsSearchBar, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
                    <MaterialIcons name="search" size={18} color={theme.colors.textSecondary} style={styles.fsSearchIcon} />
                    <TextInput
                      style={[styles.fsSearchInput, { color: theme.colors.text, fontFamily: 'Inter_400Regular' }]}
                      placeholder="Search apps..."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={fsSearchQuery}
                      onChangeText={setFsSearchQuery}
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="search"
                    />
                    {fsSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setFsSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialIcons name="close" size={16} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.fsSortContainer}>
                    <TouchableOpacity
                      style={[styles.fsSortBtn, {
                        backgroundColor: fsSortMode !== 'default' ? `${theme.colors.primary}18` : theme.colors.cardPrimary,
                        borderColor: fsSortMode !== 'default' ? theme.colors.primary : theme.colors.border,
                      }]}
                      onPress={() => setShowFsSortMenu(v => !v)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons
                        name="sort"
                        size={18}
                        color={fsSortMode !== 'default' ? theme.colors.primary : theme.colors.textSecondary}
                      />
                    </TouchableOpacity>

                    {showFsSortMenu && (
                      <View style={[styles.fsSortMenu, {
                        backgroundColor: theme.colors.cardPrimary,
                        borderColor: theme.colors.border,
                        shadowColor: isDark ? '#000' : '#AAA',
                      }]}>
                        {([
                          { key: 'default', label: 'Default Order', icon: 'reorder' },
                          { key: 'az',      label: 'A \u2192 Z',         icon: 'sort-by-alpha' },
                          { key: 'za',      label: 'Z \u2192 A',         icon: 'sort-by-alpha' },
                        ] as const).map(opt => (
                          <TouchableOpacity
                            key={opt.key}
                            style={[styles.fsSortOption, {
                              backgroundColor: fsSortMode === opt.key ? `${theme.colors.primary}14` : 'transparent',
                            }]}
                            onPress={() => { setFsSortMode(opt.key); setShowFsSortMenu(false); }}
                          >
                            <MaterialIcons
                              name={opt.icon as any}
                              size={15}
                              color={fsSortMode === opt.key ? theme.colors.primary : theme.colors.textSecondary}
                            />
                            <Text style={[styles.fsSortOptTxt, {
                              color: fsSortMode === opt.key ? theme.colors.primary : theme.colors.text,
                              fontFamily: fsSortMode === opt.key ? 'Inter_600SemiBold' : 'Inter_400Regular',
                            }]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </Animated.View>

              {/* Extra tile rows \u2014 fill all available space between header and Row1 */}
              <ScrollView
                style={styles.fsScroll}
                contentContainerStyle={styles.fsScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {fsDisplayItems.length === 0 ? (
                  <View style={styles.fsEmpty}>
                    <MaterialIcons name="search-off" size={36} color={theme.colors.border} />
                    <Text style={[styles.fsEmptyTxt, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                      No apps found
                    </Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {fsDisplayItems.map(item => (
                      <TabButton
                        key={item.id}
                        item={item}
                        isActive={isActiveItem(item)}
                        onPress={() => { setShowFsSortMenu(false); onTabPress(item); }}
                        theme={theme}
                        drawerMode
                      />
                    ))}
                  </View>
                )}
              </ScrollView>

              {/* Row1 \u2014 the original compact dock bar, always pinned at the bottom */}
              <View style={[styles.row, { paddingBottom: bottomPad, backgroundColor: theme.colors.background }]}>
                {row1.map(item => (
                  <TabButton
                    key={item.id}
                    item={item}
                    isActive={isActiveItem(item)}
                    onPress={() => { setShowFsSortMenu(false); onTabPress(item); }}
                    theme={theme}
                    compact
                  />
                ))}
              </View>
            </Animated.View>
          </GestureDetector>
        </>
      )}


      {/* ── Task Composer (always available) ──────────────────────────────────── */}
      <TaskComposer visible={showTask} onClose={() => setShowTask(false)} onSave={(td) => handleComposerSave(td)} />
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
  },
  grabberArea: {
    height: GRABBER_H,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  grabberPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    marginVertical: 2,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
    flex: 1,
  },
  emptyTxt: {
    fontSize: 11,
  },
  fsPanel: {
    paddingTop: 0,
    overflow: 'hidden',
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  fsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  fsSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    gap: 8,
    elevation: 1.5,
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  fsSearchIcon: { marginRight: 2 },
  fsSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  // ── Sort ────────────────────────────────────────────────────────────────────
  fsSortContainer: {
    position: 'relative',
  },
  fsSortBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1.5,
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  fsSortMenu: {
    position: 'absolute',
    top: 52,
    right: 0,
    width: 172,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    zIndex: 200,
  },
  fsSortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  fsSortOptTxt: {
    fontSize: 13,
  },
  // ── Grid scroll ─────────────────────────────────────────────────────────────
  fsScroll: {
    flex: 1,
  },
  fsScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  fsEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  fsEmptyTxt: {
    fontSize: 14,
  },
  // ── Pinned Quick Access Footer ───────────────────────────────────────────────
  fsDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
  },
  fsQuickRow: {
    flexDirection: 'row',
    paddingTop: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Compact-style tile for the fullscreen drawer — identical look to bottom dock, 4 per row
  fsDrawerItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
  },
  gridItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  gridIconBg: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 10,
  },
  fabStack: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
    zIndex: 20,
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionLabelWrap: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    elevation: 3,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  optionLabel: { fontSize: 13 },
  optionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fab: {
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
