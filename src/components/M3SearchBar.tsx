import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Typography, BorderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export function M3SearchBar({
  value,
  onChangeText,
  placeholder = 'Search expenses, groups or friends...',
  onClear,
}: M3SearchBarProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceContainerHigh }]}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.onSurfaceVariant} strokeWidth="2" strokeLinecap="round">
        <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </Svg>
      <TextInput
        style={[styles.input, { color: colors.onSurface }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear || (() => onChangeText(''))}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.onSurfaceVariant} strokeWidth="2">
            <Path d="M18 6L6 18M6 6l12 12" />
          </Svg>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    height: 48,
    gap: 10,
  },
  input: {
    flex: 1,
    ...Typography.bodyMd,
  },
});
