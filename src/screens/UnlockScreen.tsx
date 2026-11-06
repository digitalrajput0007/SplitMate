import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import { PinPad } from '../components/PinPad';
import { verifyPin } from '../services/appLockService';
import { authenticateBiometric, checkBiometricHardware, checkBiometricEnrolled } from '../services/biometricService';
import { useSecurity } from '../context/SecurityContext';

enum AuthState {
  INITIALIZING = 'INITIALIZING',
  BIOMETRIC = 'BIOMETRIC',
  PIN_ENTRY = 'PIN_ENTRY',
}

export default function UnlockScreen() {
  const { colors } = useTheme();
  const dialog = useDialog();
  const { lockSettings, setIsUnlocked } = useSecurity();
  const [authState, setAuthState] = useState<AuthState>(AuthState.INITIALIZING);
  const [pin, setPin] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const pinLength = lockSettings.pinLength;

  const handleBiometricAuth = useCallback(async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    try {
      const result = await authenticateBiometric('Unlock SplitMate');
      if (result.success) {
        setIsUnlocked(true);
      } else {
        // If biometric fails or is cancelled, and PIN is enabled, switch to PIN
        if (lockSettings.isPinEnabled) {
          setAuthState(AuthState.PIN_ENTRY);
        }
      }
    } catch (e) {
      console.error('Biometric auth failed', e);
      if (lockSettings.isPinEnabled) {
        setAuthState(AuthState.PIN_ENTRY);
      }
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAuthenticating, lockSettings.isPinEnabled, setIsUnlocked]);

  useEffect(() => {
    const initAuth = async () => {
      const hasHardware = await checkBiometricHardware();
      const isEnrolled = await checkBiometricEnrolled();

      if (lockSettings.isBiometricEnabled && hasHardware && isEnrolled) {
        setAuthState(AuthState.BIOMETRIC);
        // Small delay to ensure UI transition before prompt
        setTimeout(handleBiometricAuth, 300);
      } else if (lockSettings.isPinEnabled) {
        setAuthState(AuthState.PIN_ENTRY);
      } else {
        // Fallback if somehow nothing is enabled but we are here
        setIsUnlocked(true);
      }
    };

    initAuth();
  }, [lockSettings.isBiometricEnabled, lockSettings.isPinEnabled, handleBiometricAuth, setIsUnlocked]);

  const handleNumberPress = async (num: string) => {
    if (pin.length < pinLength) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === pinLength) {
        const isValid = await verifyPin(newPin);
        if (isValid) {
          setIsUnlocked(true);
        } else {
          dialog.showError('Incorrect PIN', 'Please try again.');
          setPin('');
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  // Rendering logic based on state
  if (authState === AuthState.INITIALIZING) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.primaryContainer }]}>
            <Ionicons name="lock-closed" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.onBackground }]}>App Locked</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            {authState === AuthState.BIOMETRIC ? 'Confirm Identity' : 'Enter PIN to unlock'}
          </Text>
        </View>

        {authState === AuthState.PIN_ENTRY ? (
          <>
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
          </>
        ) : (
          <View style={styles.biometricStateContainer}>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={handleBiometricAuth}
              disabled={isAuthenticating}
            >
              <MaterialIcons name="fingerprint" size={32} color={colors.onPrimary} />
              <Text style={[styles.retryBtnText, { color: colors.onPrimary }]}>Tap to Unlock</Text>
            </TouchableOpacity>

            {lockSettings.isPinEnabled && (
              <TouchableOpacity
                style={styles.switchAuthBtn}
                onPress={() => setAuthState(AuthState.PIN_ENTRY)}
              >
                <Text style={[styles.switchAuthText, { color: colors.primary }]}>Use PIN instead</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isAuthenticating && authState === AuthState.PIN_ENTRY && (
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
  biometricStateContainer: {
    alignItems: 'center',
    gap: Spacing.xl,
    marginTop: Spacing.xl,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 12,
    ...Shadows.button,
  },
  retryBtnText: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  switchAuthBtn: {
    padding: Spacing.md,
  },
  switchAuthText: {
    ...Typography.labelLg,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
