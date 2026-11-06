import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../theme';

interface AppLoaderProps {
  message?: string;
  overlay?: boolean;
}

export function AppLoader({ message = 'Loading...', overlay = false }: AppLoaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        overlay
          ? [styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.4)' }]
          : { backgroundColor: colors.background },
      ]}
    >
      <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
        <LottieView
          source={require('../../assets/splash_animation.json')}
          autoPlay
          loop
          style={styles.lottie}
        />
        {message ? (
          <Text style={[styles.message, { color: colors.onSurface }]}>{message}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  card: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  lottie: {
    width: 120,
    height: 120,
  },
  message: {
    ...Typography.bodyMd,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
