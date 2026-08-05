import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Typography, BorderRadius, Shadows, Motion } from '../constants/theme';

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
  const getVariantStyle = () => {
    switch (variant) {
      case 'outlined':
        return styles.outlined;
      case 'tonal':
        return styles.tonal;
      case 'text':
        return styles.textVariant;
      case 'filled':
      default:
        return styles.filled;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outlined':
      case 'text':
        return styles.textOutlined;
      case 'tonal':
        return styles.textTonal;
      case 'filled':
      default:
        return styles.textFilled;
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
        <ActivityIndicator color={variant === 'filled' ? Colors.onPrimary : Colors.primary} />
      ) : (
        <>
          {icon}
          <Text style={[styles.baseText, getTextStyle(), textStyle]}>{label}</Text>
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

  filled: { backgroundColor: Colors.primary, ...Shadows.button },
  outlined: { borderWidth: 1, borderColor: Colors.outline, backgroundColor: 'transparent' },
  tonal: { backgroundColor: Colors.secondaryContainer },
  textVariant: { backgroundColor: 'transparent' },

  baseText: { ...Typography.titleSm, fontWeight: '600' },
  textFilled: { color: Colors.onPrimary },
  textOutlined: { color: Colors.primary },
  textTonal: { color: Colors.onSecondaryContainer },

  disabled: { opacity: 0.5 },
});
