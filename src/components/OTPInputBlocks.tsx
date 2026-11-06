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

  // Sync internal state with external value
  useEffect(() => {
    const externalArray = (value || '').split('').concat(['', '', '', '', '', '']).slice(0, 6);
    if (externalArray.join('') !== otpArray.join('')) {
      setOtpArray(externalArray);
    }
  }, [value]);

  const handleTextChange = (text: string, index: number) => {
    const newText = text.replace(/[^0-9]/g, '');

    // Handle multi-character input (e.g. paste)
    if (newText.length > 1) {
      const newOtpArray = [...otpArray];
      const sliced = newText.slice(0, 6 - index);
      for (let i = 0; i < sliced.length; i++) {
        newOtpArray[index + i] = sliced[i];
      }
      setOtpArray(newOtpArray);
      const fullCode = newOtpArray.join('');
      onChange(fullCode);

      const nextIndex = Math.min(index + sliced.length, 5);
      inputs.current[nextIndex]?.focus();

      if (fullCode.length === 6 && onComplete) {
        onComplete(fullCode);
      }
      return;
    }

    const singleChar = newText.slice(-1); // Take latest typed char if box already had text
    const newOtpArray = [...otpArray];
    newOtpArray[index] = singleChar;
    setOtpArray(newOtpArray);
    const fullCode = newOtpArray.join('');
    onChange(fullCode);

    if (singleChar !== '' && index < 5) {
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
    if (e.nativeEvent.key === 'Backspace') {
      if (otpArray[index] !== '') {
        // Clear current block on backspace
        const newOtpArray = [...otpArray];
        newOtpArray[index] = '';
        setOtpArray(newOtpArray);
        onChange(newOtpArray.join(''));
      } else if (index > 0) {
        // Move to previous block if current block was already empty
        inputs.current[index - 1]?.focus();
        const newOtpArray = [...otpArray];
        newOtpArray[index - 1] = '';
        setOtpArray(newOtpArray);
        onChange(newOtpArray.join(''));
      }
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
            disabled && { opacity: 0.6 },
          ]}
          value={digit}
          onChangeText={(text) => handleTextChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          keyboardType="number-pad"
          maxLength={6}
          textAlign="center"
          editable={!disabled}
          autoFocus={index === 0}
          selectTextOnFocus
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    paddingHorizontal: 4,
    marginBottom: Spacing.xl,
  },
  input: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    fontSize: 22,
    fontWeight: '700',
  },
});
