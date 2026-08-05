import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'filled' | 'outlined';
  style?: ViewStyle;
}

export function M3Card({ children, variant = 'elevated', style }: M3CardProps) {
  const { colors } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'filled':
        return { backgroundColor: colors.surfaceContainerLow };
      case 'outlined':
        return {
          backgroundColor: colors.surfaceContainerLowest,
          borderWidth: 1,
          borderColor: colors.outlineVariant,
        };
      case 'elevated':
      default:
        return {
          backgroundColor: colors.surfaceContainerLowest,
          ...Shadows.card,
          borderWidth: 1,
          borderColor: colors.divider,
        };
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
});
