import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Typography, BorderRadius, Shadows } from '../constants/theme';
import { M3Button } from './M3Button';
import { useTheme } from '../context/ThemeContext';

export interface M3DialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  destructive?: boolean;
}

export function M3Dialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onDismiss,
  destructive = false,
}: M3DialogProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{message}</Text>
          <View style={styles.actions}>
            <M3Button label={cancelLabel} variant="text" onPress={onDismiss} size="sm" />
            <M3Button
              label={confirmLabel}
              variant="filled"
              onPress={onConfirm}
              size="sm"
              style={destructive ? { backgroundColor: colors.error } : undefined}
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    padding: 24,
    gap: 12,
    ...Shadows.dialog,
  },
  title: { ...Typography.headlineLgMobile, fontSize: 20 },
  message: { ...Typography.bodyMd },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
