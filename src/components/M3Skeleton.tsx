import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, BorderRadius } from '../constants/theme';

export function M3Skeleton({ width = '100%', height = 20, style }: { width?: any; height?: number; style?: any }) {
  return <View style={[styles.skeleton, { width, height }, style]} />;
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.md,
    opacity: 0.6,
  },
});
