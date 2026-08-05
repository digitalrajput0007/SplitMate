import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3SnackbarProps {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

export function M3Snackbar({ visible, message, actionLabel, onAction, onDismiss }: M3SnackbarProps) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <View style={[styles.snackbar, { backgroundColor: colors.inverseSurface }]}>
      <Text style={[styles.text, { color: colors.onSurface }]}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={[styles.action, { color: colors.inversePrimary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  snackbar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.cardElevated,
    zIndex: 100,
  },
  text: { ...Typography.bodyMd, flex: 1 },
  action: { ...Typography.titleSm, fontWeight: '600', marginLeft: 12 },
});
