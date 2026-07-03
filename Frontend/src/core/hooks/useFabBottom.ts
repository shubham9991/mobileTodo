import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useManage } from '../ManageContext';

/**
 * Returns the dynamic bottom position for the FAB so it always floats
 * above the BottomNavbar regardless of the user's Android nav mode.
 */
export const useFabBottom = () => {
  const insets = useSafeAreaInsets();
  const { hideDock } = useManage();

  if (hideDock) {
    return insets.bottom + 16;
  }

  const navbarHeight =
    10 +          // paddingTop
    24 +          // icon size
    3  +          // gap between icon and label
    14 +          // label height (fontSize 11)
    (insets.bottom + 12); // dynamic bottom padding
  return navbarHeight + 16;   // 16px breathing room above the navbar
};
