import { Component } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

/**
 * Catches render crashes so the app shows a recovery UI instead of a red screen.
 * Async/API errors should still use toasts — this is last-resort for UI trees.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (__DEV__) {
      console.warn(
        '[ErrorBoundary]',
        error?.message || error,
        info?.componentStack?.slice?.(0, 240)
      );
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Qalad lama filaan ah</Text>
        <Text style={styles.sub}>
          App-ku wuu joogsaday meel — isku day dib u furid. Macluumaadkaaga waa badbaadsan.
        </Text>
        <Pressable onPress={this.handleRetry} style={styles.btn} accessibilityRole="button">
          <Text style={styles.btnText}>Isku day</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0B1F33',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  sub: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    maxWidth: 320,
  },
  btn: {
    marginTop: 20,
    backgroundColor: '#16A34A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
