import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BorderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export function M3Skeleton({ width = '100%', height = 20, style }: { width?: any; height?: number; style?: any }) {
  const { colors } = useTheme();
  return <View style={[styles.skeleton, { width, height, backgroundColor: colors.surfaceContainerHigh }, style]} />;
}

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: BorderRadius.md,
    opacity: 0.6,
  },
});
