import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Typography, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'tonal' | 'text';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function M3Button({
  label,
  onPress,
  variant = 'filled',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: M3ButtonProps) {
  const { colors } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'outlined':
        return { borderWidth: 1, borderColor: colors.outline, backgroundColor: 'transparent' };
      case 'tonal':
        return { backgroundColor: colors.secondaryContainer };
      case 'text':
        return { backgroundColor: 'transparent' };
      case 'filled':
      default:
        return { backgroundColor: colors.primary, ...Shadows.button };
    }
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'outlined':
      case 'text':
        return colors.primary;
      case 'tonal':
        return colors.onSecondaryContainer;
      case 'filled':
      default:
        return colors.onPrimary;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      case 'md':
      default:
        return styles.sizeMd;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        getVariantStyle(),
        getSizeStyle(),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'filled' ? colors.onPrimary : colors.primary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.baseText, { color: getTextColor() }, textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: BorderRadius.md,
  },
  sizeSm: { minHeight: 36, paddingHorizontal: 16, paddingVertical: 6 },
  sizeMd: { minHeight: 48, paddingHorizontal: 24, paddingVertical: 12 },
  sizeLg: { minHeight: 56, paddingHorizontal: 32, paddingVertical: 16 },

  baseText: { ...Typography.titleSm, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
