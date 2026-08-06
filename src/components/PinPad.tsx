import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface PinPadProps {
  onPressNumber: (num: string) => void;
  onPressDelete: () => void;
  onPressBiometric?: () => void;
  showBiometric?: boolean;
}

const { width } = Dimensions.get('window');
const BUTTON_SIZE = width * 0.2;

export function PinPad({ onPressNumber, onPressDelete, onPressBiometric, showBiometric }: PinPadProps) {
  const { colors } = useTheme();

  const renderButton = (content: string | React.ReactNode, onPress: () => void, isSpecial = false) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: isSpecial ? 'transparent' : colors.surfaceContainerLow }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {typeof content === 'string' ? (
        <Text style={[styles.buttonText, { color: colors.onSurface }]}>{content}</Text>
      ) : (
        content
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {renderButton('1', () => onPressNumber('1'))}
        {renderButton('2', () => onPressNumber('2'))}
        {renderButton('3', () => onPressNumber('3'))}
      </View>
      <View style={styles.row}>
        {renderButton('4', () => onPressNumber('4'))}
        {renderButton('5', () => onPressNumber('5'))}
        {renderButton('6', () => onPressNumber('6'))}
      </View>
      <View style={styles.row}>
        {renderButton('7', () => onPressNumber('7'))}
        {renderButton('8', () => onPressNumber('8'))}
        {renderButton('9', () => onPressNumber('9'))}
      </View>
      <View style={styles.row}>
        {showBiometric ? (
          renderButton(<Ionicons name="finger-print" size={32} color={colors.primary} />, onPressBiometric || (() => {}), true)
        ) : (
          <View style={styles.emptyButton} />
        )}
        {renderButton('0', () => onPressNumber('0'))}
        {renderButton(<Ionicons name="backspace-outline" size={28} color={colors.onSurface} />, onPressDelete, true)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  buttonText: {
    ...Typography.headlineSm,
    fontWeight: '600',
  },
});
