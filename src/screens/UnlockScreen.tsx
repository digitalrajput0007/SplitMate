import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { PinPad } from '../components/PinPad';
import { verifyPin } from '../services/appLockService';
import { authenticateBiometric } from '../services/biometricService';
import { useSecurity } from '../context/SecurityContext';

export default function UnlockScreen() {
  const { colors } = useTheme();
  const { lockSettings, setIsUnlocked } = useSecurity();
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const pinLength = lockSettings.pinLength;

  useEffect(() => {
    if (lockSettings.isBiometricEnabled) {
      handleBiometricAuth();
    }
  }, []);

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);
    try {
      const result = await authenticateBiometric('Unlock SplitMate');
      if (result.success) {
        setIsUnlocked(true);
      }
    } catch (e) {
      console.error('Biometric auth failed', e);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleNumberPress = async (num: string) => {
    if (pin.length < pinLength) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === pinLength) {
        const isValid = await verifyPin(newPin);
        if (isValid) {
          setIsUnlocked(true);
        } else {
          Alert.alert('Incorrect PIN', 'Please try again.');
          setPin('');
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="lock-closed" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.onBackground }]}>App Locked</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Enter PIN to unlock</Text>
        </View>

        <View style={styles.dotsContainer}>
          {Array.from({ length: pinLength }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i < pin.length ? colors.primary : colors.surfaceContainerHigh,
                  borderColor: colors.outlineVariant,
                },
              ]}
            />
          ))}
        </View>

        <PinPad
          onPressNumber={handleNumberPress}
          onPressDelete={handleDelete}
          onPressBiometric={handleBiometricAuth}
          showBiometric={lockSettings.isBiometricEnabled}
        />

        {isAuthenticating && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: Spacing.xxl },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { ...Typography.headlineSm, fontWeight: '700', marginBottom: 4 },
  subtitle: { ...Typography.bodyMd },
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
