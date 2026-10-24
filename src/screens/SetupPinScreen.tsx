import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Typography, Spacing, Colors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import { PinPad } from '../components/PinPad';
import { setPin } from '../services/appLockService';
import { useSecurity } from '../context/SecurityContext';

export default function SetupPinScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const dialog = useDialog();
  const { lockSettings, updateLockSettings } = useSecurity();
  const [pin, setPinState] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const pinLength = lockSettings.pinLength;

  const handleNumberPress = (num: string) => {
    if (!isConfirming) {
      if (pin.length < pinLength) {
        const newPin = pin + num;
        setPinState(newPin);
        if (newPin.length === pinLength) {
          setTimeout(() => setIsConfirming(true), 200);
        }
      }
    } else {
      if (confirmPin.length < pinLength) {
        const newConfirm = confirmPin + num;
        setConfirmPin(newConfirm);
        if (newConfirm.length === pinLength) {
          validateAndSave(newConfirm);
        }
      }
    }
  };

  const validateAndSave = async (finalConfirm: string) => {
    if (pin === finalConfirm) {
      try {
        await setPin(pin);
        await updateLockSettings({ ...lockSettings, isPinEnabled: true });
        dialog.showSuccess('Success', 'PIN set successfully', () => {
          navigation.goBack();
        });
      } catch (e) {
        dialog.showError('Error', 'Failed to save PIN');
      }
    } else {
      dialog.showError('Mismatch', 'PINs do not match. Try again.');
      setPinState('');
      setConfirmPin('');
      setIsConfirming(false);
    }
  };

  const handleDelete = () => {
    if (!isConfirming) {
      setPinState(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.onBackground }]}>Setup PIN</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.instruction, { color: colors.onSurfaceVariant }]}>
          {isConfirming ? 'Confirm your PIN' : `Enter a ${pinLength}-digit PIN`}
        </Text>

        <View style={styles.dotsContainer}>
          {Array.from({ length: pinLength }).map((_, i) => {
            const isFilled = isConfirming ? i < confirmPin.length : i < pin.length;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isFilled ? colors.primary : colors.surfaceContainerHigh,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              />
            );
          })}
        </View>

        <PinPad onPressNumber={handleNumberPress} onPressDelete={handleDelete} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.titleLg, fontWeight: '700' },
  content: { flex: 1, alignItems: 'center', paddingTop: 60 },
  instruction: { ...Typography.bodyLg, marginBottom: Spacing.xxl },
  dotsContainer: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
});
