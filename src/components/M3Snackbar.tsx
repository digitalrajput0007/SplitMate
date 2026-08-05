import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, BorderRadius, Shadows } from '../constants/theme';

export interface M3SnackbarProps {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}

export function M3Snackbar({ visible, message, actionLabel, onAction, onDismiss }: M3SnackbarProps) {
  if (!visible) return null;

  return (
    <View style={styles.snackbar}>
      <Text style={styles.text}>{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.action}>{actionLabel}</Text>
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
    backgroundColor: Colors.inverseSurface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.cardElevated,
    zIndex: 100,
  },
  text: { ...Typography.bodyMd, color: Colors.inverseOnSurface, flex: 1 },
  action: { ...Typography.titleSm, color: Colors.inversePrimary, fontWeight: '600', marginLeft: 12 },
});
