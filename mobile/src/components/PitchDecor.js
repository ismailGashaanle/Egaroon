import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line, Circle, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';

/**
 * Decorative football pitch + glow for Hoyga hero. Pointer-events none.
 */
export default function PitchDecor({ height = 292 }) {
  const { width } = useWindowDimensions();
  const pitchX = width * 0.52;
  const pitchW = width * 0.58;
  const pitchY = 56;
  const pitchH = height - 92;
  const midX = pitchX + pitchW / 2;
  const midY = pitchY + pitchH / 2;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="hoygaHero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#12261C" />
            <Stop offset="0.4" stopColor="#1E2433" />
            <Stop offset="1" stopColor="#0F1720" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#hoygaHero)" />
        <Ellipse cx={width * 0.9} cy={28} rx={110} ry={96} fill="#10B981" opacity={0.2} />
        <Ellipse cx={-16} cy={height - 10} rx={120} ry={90} fill="#10B981" opacity={0.1} />
        <Rect
          x={pitchX}
          y={pitchY}
          width={pitchW}
          height={pitchH}
          rx={10}
          fill="none"
          stroke="#10B981"
          strokeWidth={1.4}
          opacity={0.28}
        />
        <Line
          x1={midX}
          y1={pitchY}
          x2={midX}
          y2={pitchY + pitchH}
          stroke="#10B981"
          strokeWidth={1.2}
          opacity={0.22}
        />
        <Circle
          cx={midX}
          cy={midY}
          r={32}
          fill="none"
          stroke="#10B981"
          strokeWidth={1.2}
          opacity={0.22}
        />
        <Circle cx={midX} cy={midY} r={3} fill="#10B981" opacity={0.35} />
        <Rect
          x={pitchX}
          y={midY - 36}
          width={28}
          height={72}
          fill="none"
          stroke="#10B981"
          strokeWidth={1.2}
          opacity={0.18}
        />
      </Svg>
    </View>
  );
}
