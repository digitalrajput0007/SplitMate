import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3FabProps {
  onPress: () => void;
  label?: string;
  icon?: React.ReactNode;
  extended?: boolean;
}

export function M3Fab({ onPress, label = 'Add', icon, extended = false }: M3FabProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        extended ? styles.extended : styles.standard,
        { backgroundColor: colors.primaryContainer },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {icon || (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.onPrimaryContainer} strokeWidth="2.5" strokeLinecap="round">
          <Path d="M12 5v14M5 12h14" />
        </Svg>
      )}
      {extended && <Text style={[styles.label, { color: colors.onPrimaryContainer }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    ...Shadows.button,
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 99,
  },
  standard: { width: 56, height: 56 },
  extended: { height: 56, paddingHorizontal: 20, flexDirection: 'row', gap: 10 },
  label: { ...Typography.titleSm, fontWeight: '600' },
});
