import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { Spacing, BorderRadius } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface OTPInputBlocksProps {
  value: string;
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  disabled?: boolean;
}

export const OTPInputBlocks: React.FC<OTPInputBlocksProps> = ({
  value,
  onChange,
  onComplete,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const inputs = useRef<TextInput[]>([]);
  const [otpArray, setOtpArray] = useState<string[]>(['', '', '', '', '', '']);

  // Sync internal state with external value (e.g. for clearing)
  useEffect(() => {
    if (value === '') {
      setOtpArray(['', '', '', '', '', '']);
    } else if (value.length === 6 && value !== otpArray.join('')) {
        setOtpArray(value.split(''));
    }
  }, [value]);

  const handleTextChange = (text: string, index: number) => {
    const newText = text.replace(/[^0-9]/g, '');
    const newOtpArray = [...otpArray];

    // Handle multi-character input (e.g. paste)
    if (newText.length > 1) {
        const sliced = newText.slice(0, 6 - index);
        for (let i = 0; i < sliced.length; i++) {
            newOtpArray[index + i] = sliced[i];
        }
        setOtpArray(newOtpArray);
        const fullCode = newOtpArray.join('');
        onChange(fullCode);

        // Focus the appropriate input
        const nextIndex = Math.min(index + sliced.length, 5);
        inputs.current[nextIndex]?.focus();

        if (fullCode.length === 6 && onComplete) {
          onComplete(fullCode);
        }
        return;
    }

    newOtpArray[index] = newText;
    setOtpArray(newOtpArray);
    const fullCode = newOtpArray.join('');
    onChange(fullCode);

    if (newText !== '' && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (fullCode.length === 6 && onComplete) {
      onComplete(fullCode);
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace' && otpArray[index] === '' && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {otpArray.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            if (ref) inputs.current[index] = ref;
          }}
          style={[
            styles.input,
            {
              borderColor: digit !== '' ? colors.primary : colors.outlineVariant,
              color: colors.onSurface,
              backgroundColor: colors.surfaceContainerLowest,
            },
            disabled && { opacity: 0.6 }
          ]}
          value={digit}
          onChangeText={(text) => handleTextChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={6} // Allow multi-char for paste handling, but usually maxLength=1
          textAlign="center"
          editable={!disabled}
          autoFocus={index === 0}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: Spacing.xl,
  },
  input: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    fontSize: 22,
    fontWeight: '700',
  },
});
