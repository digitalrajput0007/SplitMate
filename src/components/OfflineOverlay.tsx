import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '../theme';

const { width, height } = Dimensions.get('window');

export const OfflineOverlay = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(height))[0];

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
      if (state.isConnected === false) {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }),
        ]).start();
      }
    });

    return () => unsubscribe();
  }, [fadeAnim, slideAnim]);

  if (isConnected !== false) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.content}>
        <MaterialIcons name="wifi-off" size={64} color="#EF4444" />
        <Text style={styles.title}>You're Offline</Text>
        <Text style={styles.message}>
          Please check your internet connection to view your latest balances and sync your expenses.
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  content: {
    backgroundColor: '#FFFFFF',
    padding: Spacing.xl,
    borderRadius: 24,
    alignItems: 'center',
    width: width * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    ...Typography.titleLg,
    fontWeight: 'bold',
    color: '#1F2937',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  message: {
    ...Typography.bodyMd,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
  },
});
