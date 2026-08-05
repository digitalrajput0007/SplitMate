import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Typography, BorderRadius, Shadows } from '../constants/theme';

export interface M3CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined';
  style?: ViewStyle;
}

export function M3Card({ children, variant = 'elevated', style }: M3CardProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case 'filled':
        return styles.filled;
      case 'outlined':
        return styles.outlined;
      case 'elevated':
      default:
        return styles.elevated;
    }
  };

  return <View style={[styles.base, getVariantStyle(), style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.lg,
    padding: 16,
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  filled: {
    backgroundColor: Colors.surfaceContainerLow,
  },
  outlined: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
});
