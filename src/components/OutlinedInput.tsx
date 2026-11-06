import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface OutlinedInputProps extends TextInputProps {
  label: string;
  error?: string;
}

function OpenEyeSvg({ color, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" fill={color} />
    </Svg>
  );
}

function ClosedEyeSvg({ color, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Path d="M1 1l22 22" />
    </Svg>
  );
}

export function OutlinedInput({ label, error, style, secureTextEntry, editable, ...props }: OutlinedInputProps) {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isSecure = secureTextEntry && !isPasswordVisible;
  const isDisabled = editable === false;

  const labelColor = error ? colors.error : isFocused ? colors.primary : colors.onSurfaceVariant;
  const borderColor = error ? colors.error : isFocused ? colors.primary : colors.outlineVariant;
  const bgColor = isDisabled ? colors.surfaceContainerLow : colors.surfaceContainerLowest;
  const textColor = isDisabled ? colors.onSurfaceVariant : colors.onSurface;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            secureTextEntry && styles.inputWithIcon,
            {
              borderColor,
              borderWidth: isFocused ? 2 : 1,
              backgroundColor: bgColor,
              color: textColor,
            },
            style,
          ]}
          placeholderTextColor={colors.outlineVariant}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isSecure}
          editable={editable}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {isPasswordVisible ? (
              <OpenEyeSvg color={isFocused ? colors.primary : colors.outline} size={20} />
            ) : (
              <ClosedEyeSvg color={isFocused ? colors.primary : colors.outline} size={20} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.labelLg,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
    width: '100%',
  },
  input: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 48,
    ...Typography.bodyMd,
  },
  inputWithIcon: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  errorText: {
    ...Typography.labelMd,
    marginTop: Spacing.xs,
  },
});
