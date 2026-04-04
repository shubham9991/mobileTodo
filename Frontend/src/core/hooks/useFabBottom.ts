import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns the dynamic bottom position for the FAB so it always floats
 * above the BottomNavbar regardless of the user's Android nav mode.
 *
 * BottomNavbar actual height breakdown:
 *   paddingTop  : 10px
 *   icon        : 24px
 *   gap         : 3px
 *   label text  : ~14px  (fontSize 11 + line height)
 *   paddingBottom: Math.max(insets.bottom, 8)  ← dynamic
 */
export const useFabBottom = () => {
  const insets = useSafeAreaInsets();
  const navbarHeight =
    10 +          // paddingTop
    24 +          // icon size
    3  +          // gap between icon and label
    14 +          // label height (fontSize 11)
    Math.max(insets.bottom, 8); // dynamic bottom padding
  return navbarHeight + 16;   // 16px breathing room above the navbar
};
