import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Typography, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children: React.ReactNode;
}

export function M3BottomSheet({ visible, onDismiss, title, children }: M3BottomSheetProps) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDismiss}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: colors.surfaceContainerLowest }]}
        >
          <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
          {title && <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>}
          <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '80%',
    ...Shadows.dialog,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: { ...Typography.titleMd, fontWeight: '600', marginBottom: 12 },
  content: { gap: 16 },
});
