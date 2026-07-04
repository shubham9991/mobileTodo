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
  Keyboard,
  BackHandler,
  Animated as RNAnimated,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  interpolateColor,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { useManage, DockItem, FabPosition } from '../../core/ManageContext';
import { TaskComposer } from '../../core/components/TaskComposer';
import { useDashboard } from '../../core/DashboardContext';

const AnimatedIcon = Animated.createAnimatedComponent(MaterialIcons);

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
const NavOption = React.memo((
  { item, openProgress, onPress, theme, fabPosition, index }: {
    item: any;
    openProgress: SharedValue<number>;
    onPress: () => void;
    theme: any;
    fabPosition: FabPosition;
    index: number;
  }
) => {
  const { isDark } = useTheme();

  const animStyle = useAnimatedStyle(() => {
    const start = index * 0.16;
    const end = Math.min(1.0, start + 0.45);
    const p = interpolate(openProgress.value, [start, end], [0, 1], Extrapolation.CLAMP);

    const translateY = interpolate(p, [0, 1], [30, 0]);
    const opacity = interpolate(p, [0, 0.4, 1], [0, 0, 1]);
    const scale = interpolate(p, [0, 1], [0.8, 1]);

    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });

  const labelBgColor = isDark ? 'rgba(39, 39, 42, 0.82)' : 'rgba(255, 255, 255, 0.85)';
  const labelBorderColor = isDark ? 'rgba(63, 63, 70, 0.5)' : 'rgba(228, 228, 230, 0.65)';

  const content = (fabPosition === 'left' || fabPosition === 'freeflow') ? (
    <>
      <TouchableOpacity
        style={[
          styles.optionBtn,
          { backgroundColor: item.color || theme.colors.primary },
        ]}
        onPress={onPress}
      >
        <MaterialIcons name={item.icon as any} size={20} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.optionLabelWrap,
          {
            backgroundColor: labelBgColor,
            borderColor: labelBorderColor,
          },
        ]}
        onPress={onPress}
      >
        <Text style={[styles.optionLabel, { color: theme.colors.text, fontFamily: 'Inter_500Medium' }]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    </>
  ) : (
    <>
      <TouchableOpacity
        style={[
          styles.optionLabelWrap,
          {
            backgroundColor: labelBgColor,
            borderColor: labelBorderColor,
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
    </>
  );

  return (
    <Animated.View style={[styles.optionRow, animStyle]}>
      {content}
    </Animated.View>
  );
});

// ─── BottomNavbar ──────────────────────────────────────────────────────────────
export const BottomNavbar = () => {
  const { theme, isDark } = useTheme();
  const {
    dockMode, dockItems,
    isDockExpanded, setIsDockExpanded, hideDock,
    fabPosition,
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
  const fsSearchInputRef   = useRef<TextInput>(null);

  // ── Shared values ─────────────────────────────────────────────────────────
  const progress  = useSharedValue(0);   // 2-row: 0=closed 1=open
  const startProg = useSharedValue(0);
  const fsY              = useSharedValue(SCREEN_H); // fullscreen: SCREEN_H=closed 0=open
  const fsStartY         = useSharedValue(0);
  // SharedValues for keyboard/search state — visible to gesture worklets synchronously via JSI.
  // React state (useState) updates are async and can't be read by onEnd during the same touch event.
  const isSearchFocusedSV  = useSharedValue(false);
  const isKeyboardVisibleSV = useSharedValue(false);

  // Controls whether FS overlay is mounted
  const [fsOpen, setFsOpen] = useState(false);

  // ── Fullscreen dock: search (local to panel, never mutates dockItems) ─
  const [fsSearchQuery, setFsSearchQuery]   = useState('');

  // Keyboard visibility — second line of defence against spurious dock-close on keyboard open.
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      isKeyboardVisibleSV.value = true;
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      isKeyboardVisibleSV.value = false;
    });
    return () => { showSub.remove(); hideSub.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const fsDisplayItems = useMemo(() => {
    const q = fsSearchQuery.trim().toLowerCase();
    // When searching: scan ALL dock items (including row1) so nothing is hidden.
    // When not searching: only show items beyond row1 to avoid duplicates.
    let items = q ? [...dockItems] : dockItems.slice(4);
    if (q) items = items.filter(i => i.label.toLowerCase().includes(q));
    return items;
  }, [dockItems, fsSearchQuery]);

  // ─── FAB Navigation Menu (When hideDock is true) ──────────────────────────────
  const [navFABOpen, setNavFABOpen] = useState(false);
  const [tempDockMounted, setTempDockMounted] = useState(false);
  const rotation = useSharedValue(0);
  const backdropOp = useSharedValue(0);
  const openProgress = useSharedValue(0);
  const tempDockY = useSharedValue(150);

  const openTempDock = useCallback(() => {
    setTempDockMounted(true);
    if (isFullscreen) {
      // For fullscreen mode: skip the compact slide-up, jump straight to the full panel
      setFsOpen(true);
      fsY.value = withSpring(0, SNAP_SPRING);
    } else if (is2Row) {
      // For 2-row mode: slide up the compact bar then immediately expand Row 2
      tempDockY.value = withSpring(0, SNAP_SPRING);
      setIsDockExpanded(true);
    } else {
      // Compact mode: just slide up the bar
      tempDockY.value = withSpring(0, SNAP_SPRING);
    }
  }, [tempDockY, isFullscreen, is2Row, fsY, setIsDockExpanded]);

  const closeTempDock = useCallback(() => {
    hapticLight();
    if (isFullscreen && fsOpen) {
      // Close the fullscreen panel first, then unmount
      fsY.value = withSpring(SCREEN_H, CLOSE_SPRING, (done) => {
        if (done) {
          runOnJS(setFsOpen)(false);
          runOnJS(setTempDockMounted)(false);
        }
      });
    } else {
      // 2-row or compact: collapse and slide down
      setIsDockExpanded(false);
      progress.value = withSpring(0, CLOSE_SPRING);
      tempDockY.value = withSpring(150, CLOSE_SPRING, (done) => {
        if (done) {
          runOnJS(setTempDockMounted)(false);
        }
      });
    }
  }, [tempDockY, isFullscreen, fsOpen, fsY, progress, setIsDockExpanded]);

  const fabScale = useSharedValue(1);

  const toggleFAB = useCallback(() => {
    hapticLight();
    if (navFABOpen) {
      rotation.value = withTiming(0, { duration: 320 });
      backdropOp.value = withTiming(0, { duration: 320 });
      openProgress.value = withTiming(0, { duration: 300 });
    } else {
      rotation.value = withTiming(45, { duration: 320 });
      backdropOp.value = withTiming(1, { duration: 320 });
      openProgress.value = withSpring(1, { damping: 17, stiffness: 85 });
    }
    setNavFABOpen(prev => !prev);
  }, [navFABOpen, rotation, backdropOp, openProgress]);

  const handleFABPress = useCallback(() => {
    if (hideDock && tempDockMounted) {
      if (navFABOpen) toggleFAB();
      closeTempDock();
    } else {
      toggleFAB();
    }
  }, [hideDock, tempDockMounted, navFABOpen, toggleFAB, closeTempDock]);

  const fabTapGesture = useMemo(() =>
    Gesture.Tap()
      .onBegin(() => {
        fabScale.value = withSpring(0.88, { damping: 10, stiffness: 350 });
      })
      .onFinalize(() => {
        fabScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      })
      .onEnd(() => {
        runOnJS(handleFABPress)();
      }),
    [fabScale, handleFABPress]
  );

  const animFABButtonStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      rotation.value,
      [0, 45],
      [theme.colors.primary, isDark ? '#27272A' : '#E4E4E7']
    );

    const shadowColor = interpolateColor(
      rotation.value,
      [0, 45],
      [theme.colors.primary, isDark ? '#000000' : '#8E8E93']
    );

    const shadowOpacity = interpolate(
      rotation.value,
      [0, 45],
      [0.35, 0.15],
      Extrapolation.CLAMP
    );

    return {
      backgroundColor,
      shadowColor,
      shadowOpacity,
      transform: [{ scale: fabScale.value }],
    };
  });

  const animFABIconStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      rotation.value,
      [0, 45],
      ['#FFFFFF', isDark ? '#FFFFFF' : '#1C1C1E']
    );

    return {
      color,
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

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

  // Reset fullscreen search when panel closes — so reopening always shows a clean state
  useEffect(() => {
    if (!fsOpen) {
      setFsSearchQuery('');
      isSearchFocusedSV.value = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsOpen]);

  const closeDock = useCallback(() => {
    hapticLight();
    if (hideDock) {
      // In hidden-dock mode the temp overlay must also be dismissed
      closeTempDock();
    } else {
      setIsDockExpanded(false);
    }
  }, [hideDock, closeTempDock, setIsDockExpanded]);

  // Android hardware back button — close the dock instead of exiting the app
  useEffect(() => {
    if (!isFullscreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fsOpen) {
        closeDock();
        return true; // consume event, prevent app exit
      }
      return false; // let normal navigation handle it
    });
    return () => sub.remove();
  }, [isFullscreen, fsOpen, hideDock, closeDock]);

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
  // Reusable gesture builder to create independent gesture instances (RNGH v2 requirement).
  // Each GestureDetector must receive its own distinct Pan gesture object.
  const makeFsPanGesture = useCallback(() => {
    return Gesture.Pan()
      .activeOffsetY([-8, 8])
      .onBegin(() => {
        runOnJS(setFsOpen)(true);
        runOnJS(setIsDockExpanded)(true);
        fsStartY.value = fsY.value;
      })
      .onUpdate((e) => {
        // Suppress movement while keyboard/search is active
        if (!isSearchFocusedSV.value && !isKeyboardVisibleSV.value) {
          fsY.value = Math.max(0, Math.min(SCREEN_H, fsStartY.value + e.translationY));
        }
      })
      .onEnd((e) => {
        // CRITICAL: if keyboard is showing or search is focused, never close the dock.
        if (isSearchFocusedSV.value || isKeyboardVisibleSV.value) {
          fsY.value = withSpring(0, SNAP_SPRING);
          return;
        }
        const flingUp   = e.velocityY < -200;
        const flingDown = e.velocityY >  200;
        const dragPct   = fsY.value / SCREEN_H;
        // Close if dragged >15% of screen (~130px) or quick downward fling
        if (flingUp || (!flingDown && dragPct < 0.15)) {
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
  }, [fsY, fsStartY, isSearchFocusedSV, isKeyboardVisibleSV, setFsOpen, setIsDockExpanded]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fsGrabberGesture = useMemo(makeFsPanGesture, [makeFsPanGesture]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fsHeaderGesture  = useMemo(makeFsPanGesture, [makeFsPanGesture]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fsRow1Gesture    = useMemo(makeFsPanGesture, [makeFsPanGesture]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fsEmptyGesture   = useMemo(makeFsPanGesture, [makeFsPanGesture]);

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

  // ROOT CAUSE FIX: use `top` animation instead of `height`.
  // With height-based animation, when the Android keyboard opens (adjustResize), the window
  // shrinks but the panel height stays SCREEN_H — the panel shifts above the screen. The
  // active Pan gesture sees this layout shift as a large downward translation and closes the dock.
  // With top-based animation + bottom:0, the panel SHRINKS to fit the visible window instead
  // of shifting, so no fake gesture event is generated. The search bar stays visible above the keyboard.
  const DOCK_BAR_H = GRABBER_H + ROW_H + bottomPad;
  const animFsPanel = useAnimatedStyle(() => {
    const top = interpolate(fsY.value, [SCREEN_H, 0], [SCREEN_H - DOCK_BAR_H, 0], Extrapolation.CLAMP);
    const paddingTop = interpolate(fsY.value, [SCREEN_H, 0], [0, insets.top], Extrapolation.CLAMP);
    return { top, paddingTop };
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

  const animRow1Style = useAnimatedStyle(() => {
    const paddingBottom = interpolate(fsY.value, [SCREEN_H, 0], [bottomPad, 8], Extrapolation.CLAMP);
    return {
      paddingBottom,
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
              {row2.map((item: DockItem) => (
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
          {/* In fullscreen mode the panel renders itself via animFsPanel below — no compact bar needed */}
          {!isFullscreen && (
            <GestureDetector gesture={is2Row ? twoRowGesture : tempDockGesture}>
              {dockContent}
            </GestureDetector>
          )}
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
          fabPosition === 'left' ? { left: 20, right: 'auto', alignItems: 'flex-start' } : { right: 20, left: 'auto', alignItems: 'flex-end' },
          { bottom: hideDock ? insets.bottom + 16 : insets.bottom + 16 + 76 },
          { zIndex: 200 },
          animFabStackStyle,
        ]}
        pointerEvents="box-none"
      >
        {/* Speed-dial options — only rendered when the FAB menu is open */}
        {navFABOpen && quickActions.map((item, idx) => (
          <NavOption
            key={item.id}
            item={item}
            openProgress={openProgress}
            onPress={item.onPress}
            theme={theme}
            fabPosition={fabPosition}
            index={idx}
          />
        ))}
        <GestureDetector gesture={fabTapGesture}>
          <Animated.View style={[styles.fab, animFABButtonStyle]}>
            <AnimatedIcon name="add" size={26} style={animFABIconStyle} />
          </Animated.View>
        </GestureDetector>
      </Animated.View>

      {/* ── Fullscreen growing dock panel ──────────────────────────────────────
           Pinned at the bottom, grows upward from dock-bar height to full screen.
           The compact Row1 always sits at the bottom (= the original dock).
           Extra tiles + search header reveal above as the panel expands.
       ───────────────────────────────────────────────────────────────────────── */}
      {isFullscreen && (!hideDock || fsOpen) && (
        <>
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
            animFsPanel,  // provides animated `top` and `paddingTop`
          ]}>
            {/* Grabber — draggable handle to open/close the panel */}
            <GestureDetector gesture={fsGrabberGesture}>
              <View style={styles.grabberArea}>
                <View style={[styles.grabberPill, { backgroundColor: theme.colors.border }]} />
              </View>
            </GestureDetector>

            {/* Search header — reveals only when drawer is nearly fully open (draggable) */}
            <GestureDetector gesture={fsHeaderGesture}>
              <Animated.View style={animFsHeader}>
                <View style={styles.fsHeader}>
                  <View style={[styles.fsSearchBar, { backgroundColor: theme.colors.cardPrimary, borderColor: theme.colors.border }]}>
                    <MaterialIcons name="search" size={20} color={theme.colors.textSecondary} style={styles.fsSearchIcon} />
                    <TextInput
                      style={[styles.fsSearchInput, { color: theme.colors.text, fontFamily: 'Inter_400Regular' }]}
                      placeholder="Search apps..."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={fsSearchQuery}
                      onChangeText={setFsSearchQuery}
                      onFocus={() => {
                        // Set SharedValue synchronously (visible to gesture worklets immediately via JSI)
                        isSearchFocusedSV.value = true;
                      }}
                      onBlur={() => {
                        isSearchFocusedSV.value = false;
                      }}
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="search"
                    />
                    {fsSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setFsSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialIcons name="close" size={18} color={theme.colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Animated.View>
            </GestureDetector>

            {/* Row1 — the original compact dock bar, moves to the top and slides up (draggable) — hidden while searching */}
            {fsSearchQuery.trim() === '' && (
              <GestureDetector gesture={fsRow1Gesture}>
                <Animated.View style={[styles.row, animRow1Style, { backgroundColor: theme.colors.background }]}>
                  {row1.map(item => (
                    <TabButton
                      key={item.id}
                      item={item}
                      isActive={isActiveItem(item)}
                      onPress={() => onTabPress(item)}
                      theme={theme}
                      compact
                    />
                  ))}
                </Animated.View>
              </GestureDetector>
            )}

            {/* Extra tile rows — fill all available space below Row1 */}
            <ScrollView
              style={styles.fsScroll}
              contentContainerStyle={[styles.fsScrollContent, { paddingBottom: bottomPad + 16 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {fsDisplayItems.length === 0 ? (
                <GestureDetector gesture={fsEmptyGesture}>
                  <View style={{ flex: 1 }}>
                    {fsSearchQuery.trim() === '' ? (
                      <View style={styles.fsEmpty}>
                        <View style={[styles.fsEmptyIconBg, { backgroundColor: `${theme.colors.textSecondary}10` }]}>
                          <MaterialIcons name="apps" size={32} color={theme.colors.textSecondary} />
                        </View>
                        <Text style={[styles.fsEmptyTxt, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                          No extra tiles
                        </Text>
                        <Text style={[styles.fsEmptySubTxt, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                          Go to Settings ➔ Dock ➔ Customize Active Tiles to add shortcuts here
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.fsEmpty}>
                        <View style={[styles.fsEmptyIconBg, { backgroundColor: `${theme.colors.textSecondary}10` }]}>
                          <MaterialIcons name="search-off" size={32} color={theme.colors.textSecondary} />
                        </View>
                        <Text style={[styles.fsEmptyTxt, { color: theme.colors.text, fontFamily: 'Inter_600SemiBold' }]}>
                          No results found
                        </Text>
                        <Text style={[styles.fsEmptySubTxt, { color: theme.colors.textSecondary, fontFamily: 'Inter_400Regular' }]}>
                          Try checking spelling or search for another app
                        </Text>
                      </View>
                    )}
                  </View>
                </GestureDetector>
              ) : (
                <View style={styles.grid}>
                  {fsDisplayItems.map(item => (
                    <TabButton
                      key={item.id}
                      item={item}
                      isActive={isActiveItem(item)}
                      onPress={() => onTabPress(item)}
                      theme={theme}
                      drawerMode
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          </Animated.View>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  fsSearchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    paddingHorizontal: 18,
    gap: 10,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  fsSearchIcon: { marginRight: 2 },
  fsSearchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  // ── Grid scroll ─────────────────────────────────────────────────────────────
  fsScroll: {
    flex: 1,
  },
  fsScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
    flexGrow: 1,
  },
  fsEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  fsEmptyIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  fsEmptyTxt: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  fsEmptySubTxt: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
