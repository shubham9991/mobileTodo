import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Pressable,
  Animated as RNAnimated,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../themes/ThemeContext';
import { useManage, DockItem } from '../../core/ManageContext';

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
const TabButton = React.memo(({
  item, isActive, onPress, theme, compact = true,
}: {
  item: DockItem;
  isActive: boolean;
  onPress: () => void;
  theme: any;
  compact?: boolean;
}) => {
  const scale = useRef(new RNAnimated.Value(isActive ? 1.08 : 1.0)).current;

  useEffect(() => {
    RNAnimated.spring(scale, {
      toValue: isActive ? 1.08 : 1.0,
      tension: 180, friction: 12, useNativeDriver: true,
    }).start();
  }, [isActive]);

  const color = isActive ? theme.colors.primary : theme.colors.textSecondary;

  return (
    <TouchableOpacity
      style={compact ? styles.navItem : styles.gridItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <RNAnimated.View style={[
        compact ? styles.iconWrap : styles.gridIconBg,
        !compact && { backgroundColor: `${color}18`, borderRadius: 16 },
        { transform: [{ scale }] },
      ]}>
        <MaterialIcons name={item.icon as any} size={compact ? 24 : 28} color={color} />
      </RNAnimated.View>
      <Text numberOfLines={1} style={[
        compact ? styles.label : styles.gridLabel,
        { color, fontFamily: 'Inter_500Medium' },
      ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
});

// ─── BottomNavbar ──────────────────────────────────────────────────────────────
export const BottomNavbar = () => {
  const { theme }    = useTheme();
  const {
    dockMode, dockItems, dockBackdropStyle, dockBackdropOpacity,
    isDockExpanded, setIsDockExpanded,
  } = useManage();
  const router    = useRouter();
  const pathname  = usePathname();
  const insets    = useSafeAreaInsets();

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
  }, [dockMode, pathname, setIsDockExpanded, progress, fsY]);

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
    router.push(item.route as any);
  }, [progress, fsY, setIsDockExpanded, router]);

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
      const delta = -e.translationY / PANEL_H;
      progress.value = Math.min(1, Math.max(0, startProg.value + delta));
    })
    .onEnd((e) => {
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
      }
    });

  const fsOpenGesture = Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onBegin(() => {
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
      if (flingUp || (!flingDown && dragPct < 0.6)) {
        fsY.value = withSpring(0, SNAP_SPRING);
        runOnJS(hapticMed)();
      } else {
        fsY.value = withSpring(SCREEN_H, CLOSE_SPRING);
        runOnJS(setIsDockExpanded)(false);
        runOnJS(hapticLight)();
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
        fsY.value = withSpring(SCREEN_H, CLOSE_SPRING);
        runOnJS(setIsDockExpanded)(false);
        runOnJS(hapticLight)();
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

  const targetBdOpacity = dockBackdropStyle === 'solid' ? 0.96 : dockBackdropOpacity;
  const backdropBg      = dockBackdropStyle === 'solid' ? theme.colors.background : '#000000';

  const anim2RowBd = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, targetBdOpacity], Extrapolation.CLAMP),
  }));

  const animFsPanel = useAnimatedStyle(() => ({
    transform: [{ translateY: fsY.value }],
  }));

  const animFsBd = useAnimatedStyle(() => ({
    opacity: interpolate(fsY.value, [SCREEN_H, 0], [0, targetBdOpacity], Extrapolation.CLAMP),
  }));

  // ── Dock content (shared between wrapped/unwrapped render) ────────────────
  const dockContent = (
    <View style={[
      styles.dock,
      {
        backgroundColor: theme.colors.background,
        borderTopColor: theme.colors.border,
        paddingBottom: bottomPad,
        zIndex: 99, // Ensure dock remains above the backdrop
      },
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
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Dock bar — wrap with appropriate gesture or none */}
      {is2Row ? (
        <GestureDetector gesture={twoRowGesture}>
          {dockContent}
        </GestureDetector>
      ) : isFullscreen ? (
        <GestureDetector gesture={fsOpenGesture}>
          {dockContent}
        </GestureDetector>
      ) : (
        dockContent
      )}

      {/* Fullscreen overlay — only mounted while open/animating to prevent touch blocking */}
      {isFullscreen && fsOpen && (
        <>
          {/* Backdrop */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: backdropBg, zIndex: 98 }, animFsBd]}
            pointerEvents="box-none"
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDock} />
          </Animated.View>

          {/* Drawer panel */}
          <GestureDetector gesture={fsGesture}>
            <Animated.View style={[
              StyleSheet.absoluteFill,
              styles.fsPanel,
              { backgroundColor: theme.colors.cardPrimary, paddingBottom: bottomPad, zIndex: 99 },
              animFsPanel,
            ]}>
              <View style={styles.grabberArea}>
                <View style={[styles.grabberPill, { backgroundColor: theme.colors.border }]} />
              </View>

              <Text style={[styles.fsTitle, { color: theme.colors.text, fontFamily: 'Inter_700Bold' }]}>
                Quick Access
              </Text>

              <View style={styles.grid}>
                {dockItems.map(item => (
                  <TabButton key={item.id} item={item} isActive={isActiveItem(item)}
                    onPress={() => onTabPress(item)} theme={theme} compact={false} />
                ))}
              </View>
            </Animated.View>
          </GestureDetector>
        </>
      )}
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
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  fsTitle: {
    fontSize: 20,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    fontSize: 11,
    textAlign: 'center',
  },
});
