import Animated, { FadeInDown } from 'react-native-reanimated';

/** Light enter motion — fade + slight slide up */
export default function FadeIn({ children, style, duration = 320 }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(duration)}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </Animated.View>
  );
}
