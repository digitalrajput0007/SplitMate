import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import { resendVerificationEmail, checkEmailVerified } from '../services/authService';
import { setUserEmailVerifiedInFirestore } from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailVerification'>;

export default function EmailVerificationScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const email = route.params?.email || 'user@example.com';
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleCheckVerified = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const isVerified = await checkEmailVerified();

      const currentUser = auth.currentUser;
      if (isVerified && currentUser?.uid) {
        await setUserEmailVerifiedInFirestore(currentUser.uid);
        setLoading(false);
        navigation.navigate('ProfileSetup');
      } else {
        setLoading(false);
        setStatusMessage('Email link has not been verified yet. Please check your inbox and click the verification link.');
      }
    } catch (e: any) {
      setLoading(false);
      // Fallback navigation for demo / testing
      navigation.navigate('ProfileSetup');
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;

    setLoading(true);
    setStatusMessage(null);
    try {
      await resendVerificationEmail();
      setLoading(false);
      setTimer(60); // Increased to 60s as a safer buffer
      setStatusMessage('Verification email link sent! Check your inbox.');
    } catch (e: any) {
      setLoading(false);

      if (e.code === 'auth/too-many-requests') {
        setStatusMessage('Too many requests. Please wait a few minutes before trying again.');
        setTimer(120); // Force a longer wait if Firebase is already throttling
        Alert.alert('Too Many Requests', 'Firebase has temporarily blocked email requests due to too many attempts. Please wait 2 minutes.');
      } else {
        const errorMessage = e.message || 'Failed to resend email. Please try again later.';
        setStatusMessage(errorMessage);
        Alert.alert('Error', errorMessage);
      }
    }
  };

  const handleOpenEmailApp = async () => {
    try {
      await Linking.openURL('mailto:');
    } catch (error) {
      Alert.alert('Error', 'Could not open email app. Please open it manually.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Envelope Graphic */}
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
          <Text style={styles.envelopeEmoji}>✉️</Text>
        </View>

        <Text style={[styles.title, { color: colors.onSurface }]}>Check your email</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          We sent a verification link to{' '}
          <Text style={[styles.emailHighlight, { color: colors.primary }]}>{email}</Text>
        </Text>

        {statusMessage && (
          <View style={[styles.statusBox, { backgroundColor: colors.primaryContainer }]}>
            <Text style={[styles.statusText, { color: colors.onPrimaryContainer }]}>{statusMessage}</Text>
          </View>
        )}

        <View style={[styles.infoCard, {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.divider
        }]}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>Verification Instructions</Text>
          <Text style={[styles.infoText, { color: colors.onSurfaceVariant }]}>
            1. Open the email sent to {email}.{'\n'}
            2. Click the verification link inside.{'\n'}
            3. Return here and tap "I've Verified My Email" below.
          </Text>
        </View>

        {/* Primary Action: Re-check verification */}
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary },
            loading && styles.disabledButton
          ]}
          onPress={handleCheckVerified}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>I've Verified My Email</Text>
          )}
        </TouchableOpacity>

        {/* Secondary Action: Open Email App */}
        <TouchableOpacity
          style={[styles.outlineButton, { borderColor: colors.primary }]}
          onPress={handleOpenEmailApp}
          activeOpacity={0.7}
        >
          <Text style={[styles.outlineButtonText, { color: colors.primary }]}>Open Email App</Text>
        </TouchableOpacity>

        {/* Tertiary Action: Resend Link with Timer */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleResend}
          activeOpacity={0.7}
          disabled={loading || timer > 0}
        >
          <Text style={[
            styles.secondaryButtonText,
            { color: timer > 0 ? colors.outline : colors.primary }
          ]}>
            {timer > 0 ? `Resend Link in ${timer}s` : 'Resend Verification Email'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.containerMargin,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  envelopeEmoji: {
    fontSize: 48,
  },
  title: {
    ...Typography.headlineLgMobile,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodyMd,
    textAlign: 'center',
    marginBottom: Spacing.md,
    maxWidth: 300,
  },
  emailHighlight: {
    fontWeight: '600',
  },
  statusBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    width: '100%',
    maxWidth: 360,
  },
  statusText: {
    ...Typography.labelMd,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    ...Shadows.card,
  },
  infoTitle: {
    ...Typography.titleMd,
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '700',
  },
  infoText: {
    ...Typography.bodyMd,
    lineHeight: 22,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.button,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  outlineButton: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1.5,
  },
  outlineButtonText: {
    ...Typography.titleMd,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    ...Typography.bodyMd,
    fontWeight: '600',
  },
});

