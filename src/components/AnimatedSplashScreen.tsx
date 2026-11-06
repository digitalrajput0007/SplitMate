import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Easing, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import LottieView from 'lottie-react-native';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
  onLayoutReady?: () => void;
  isReady: boolean;
}

/**
 * SplitMate Ultra Fintech Animated Splash Screen
 * - Multi-layer entrance (Scale + Elastic Spring + Shimmer)
 * - Rotating Shimmer ring surrounding app logo
 * - Staggered typography reveal (AppName -> Tagline)
 * - 60fps hardware-accelerated animations
 */
export function AnimatedSplashScreen({ onAnimationComplete, onLayoutReady, isReady }: AnimatedSplashScreenProps) {
  const containerFade = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Smooth 1000ms scale (0.8 -> 1) + fade in animation
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Seamless exit once app data loading completes
    if (isReady) {
      Animated.timing(containerFade, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start(() => {
        onAnimationComplete();
      });
    }
  }, [isReady]);

  return (
    <Animated.View
      style={[styles.container, { opacity: containerFade }]}
      onLayout={onLayoutReady}
    >
      {/* Centered App Logo on Seamless White Background */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 140,
    height: 140,
  },
});
