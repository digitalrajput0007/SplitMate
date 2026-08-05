import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, Shadows } from '../constants/theme';

export interface M3FabProps {
  onPress: () => void;
  label?: string;
  icon?: React.ReactNode;
  extended?: boolean;
}

export function M3Fab({ onPress, label = 'Add', icon, extended = false }: M3FabProps) {
  return (
    <TouchableOpacity
      style={[styles.fab, extended ? styles.extended : styles.standard]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {icon || (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={Colors.onPrimaryContainer} strokeWidth="2.5" strokeLinecap="round">
          <Path d="M12 5v14M5 12h14" />
        </Svg>
      )}
      {extended && <Text style={styles.label}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    backgroundColor: Colors.primaryContainer,
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
  label: { ...Typography.titleSm, color: Colors.onPrimaryContainer, fontWeight: '600' },
});
