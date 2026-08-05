import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Typography, BorderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: React.ReactNode;
  variant?: 'filter' | 'assist';
}

export function M3Chip({ label, selected = false, onPress, icon, variant = 'filter' }: M3ChipProps) {
  const { colors } = useTheme();

  const chipStyle = selected
    ? { backgroundColor: colors.primaryFixed, borderWidth: 1, borderColor: colors.primary }
    : { backgroundColor: colors.surfaceContainer, borderWidth: 1, borderColor: colors.outlineVariant };

  const textColor = selected ? colors.primary : colors.onSurfaceVariant;

  return (
    <TouchableOpacity
      style={[styles.chip, chipStyle]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && <View style={styles.iconBox}>{icon}</View>}
      <Text style={[styles.label, { color: textColor }, selected && { fontWeight: '600' }]}>
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
  iconBox: { marginRight: 2 },
  label: { ...Typography.titleSm },
});
