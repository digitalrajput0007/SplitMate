import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Colors, Typography, BorderRadius } from '../constants/theme';

export interface M3ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  variant?: 'filter' | 'assist';
}

export function M3Chip({ label, selected = false, onPress, icon, variant = 'filter' }: M3ChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected ? styles.selected : styles.unselected,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && <View style={styles.iconBox}>{icon}</View>}
      <Text style={[styles.label, selected ? styles.selectedText : styles.unselectedText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  unselected: {
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  selected: {
    backgroundColor: Colors.primaryFixed,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  iconBox: { marginRight: 2 },
  label: { ...Typography.titleSm },
  unselectedText: { color: Colors.onSurfaceVariant },
  selectedText: { color: Colors.primary, fontWeight: '600' },
});
