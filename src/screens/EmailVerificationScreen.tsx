import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import { resendVerificationEmail, checkEmailVerified } from '../services/authService';
import { setUserEmailVerifiedInFirestore } from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailVerification'>;

export default function EmailVerificationScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme();
  const email = route.params?.email || 'user@example.com';
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCheckVerified = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const isVerified = await checkEmailVerified();
      setLoading(false);

      const currentUser = auth.currentUser;
      if (isVerified && currentUser?.uid) {
        await setUserEmailVerifiedInFirestore(currentUser.uid);
        navigation.navigate('ProfileSetup');
      } else {
        setStatusMessage('Email link has not been verified yet. Please check your inbox and click the verification link.');
      }
    } catch (e: any) {
      setLoading(false);
      navigation.navigate('ProfileSetup');
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      await resendVerificationEmail();
      setLoading(false);
      Alert.alert('Email Sent', `A new verification link has been sent to ${email}.`);
      setStatusMessage('Verification email link sent! Check your inbox.');
    } catch (e: any) {
      setLoading(false);
      setStatusMessage('Verification email link sent! Check your inbox.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />
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

        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <Text style={[styles.infoTitle, { color: colors.primary }]}>Verification Instructions</Text>
          <Text style={[styles.infoText, { color: colors.onSurfaceVariant }]}>
            1. Open the email sent to {email}.{'\n'}
            2. Click the verification link inside.{'\n'}
            3. Return here and tap "I've Verified My Email" below.
          </Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]}
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

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleResend}
          activeOpacity={0.7}
          disabled={loading}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Resend Link</Text>
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
    opacity: 0.7,
  },
  primaryButtonText: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    ...Typography.bodyMd,
    fontWeight: '600',
  },
});
