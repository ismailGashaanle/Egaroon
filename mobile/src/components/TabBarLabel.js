import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const TAB_BAR_CONTENT_HEIGHT = 56;

/** Bottom tab label with green underline when focused */
export default function TabBarLabel({ label, focused }) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: focused ? '700' : '500',
          color: focused ? colors.brandGreen : colors.muted,
        }}
      >
        {label}
      </Text>
      <View
        style={[
          styles.underline,
          {
            width: focused ? 22 : 0,
            backgroundColor: colors.brandGreen,
          },
        ]}
      />
    </View>
  );
}

/**
 * Shared bottom-tab options for Captain / Owner / Manager.
 * Pads for Android system gesture / nav bar so the app bar is not stacked under it.
 */
export function useTabBarScreenOptions() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 0);

  return {
    headerShown: false,
    tabBarActiveTintColor: colors.brandGreen,
    tabBarInactiveTintColor: colors.muted,
    // We apply bottom inset ourselves — avoid React Navigation double-padding.
    safeAreaInsets: { bottom: 0 },
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      height: TAB_BAR_CONTENT_HEIGHT + bottom,
      paddingBottom: bottom,
      paddingTop: 6,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarItemStyle: {
      paddingVertical: 2,
    },
  };
}

/** @deprecated Use useTabBarScreenOptions() inside navigators for theme */
export const tabBarScreenOptions = {
  headerShown: false,
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 2,
  },
  underline: {
    marginTop: 4,
    height: 2.5,
    borderRadius: 999,
  },
});
