import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, BorderRadius, Shadows } from '../constants/theme';

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
  return (
    <View style={styles.container}>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.onSurfaceVariant} strokeWidth="2" strokeLinecap="round">
        <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </Svg>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.onSurfaceVariant}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear || (() => onChangeText(''))}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.onSurfaceVariant} strokeWidth="2">
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
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 16,
    height: 48,
    gap: 10,
  },
  input: {
    flex: 1,
    ...Typography.bodyMd,
    color: Colors.onSurface,
  },
});
