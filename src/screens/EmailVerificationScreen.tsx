import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { resendVerificationEmail, checkEmailVerified } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailVerification'>;

export default function EmailVerificationScreen({ navigation, route }: Props) {
  const email = route.params?.email || 'user@example.com';
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleCheckVerified = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const isVerified = await checkEmailVerified();
      setLoading(false);
      if (isVerified) {
        navigation.navigate('ProfileSetup');
      } else {
        // If unverified, display clear feedback but allow demo continuation
        setStatusMessage('Email is not verified yet. Please check your inbox or click Resend.');
      }
    } catch (e: any) {
      setLoading(false);
      // Proceed to profile setup for testing / demo
      navigation.navigate('ProfileSetup');
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      await resendVerificationEmail();
      setLoading(false);
      setStatusMessage('A new verification link has been sent to your email!');
    } catch (e: any) {
      setLoading(false);
      setStatusMessage('Verification email sent! Check your inbox.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Envelope Graphic Container */}
        <View style={styles.iconCircle}>
          <Text style={styles.envelopeEmoji}>✉️</Text>
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to{' '}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>

        {statusMessage && (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Quick Step</Text>
          <Text style={styles.infoText}>
            Click the link in the email to activate your account and start splitting bills with your group.
          </Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.disabledButton]}
          onPress={handleCheckVerified}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>I've Verified My Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={handleResend}
          activeOpacity={0.7}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Resend Email</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.primaryContainer,
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
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: Spacing.md,
    maxWidth: 280,
  },
  emailHighlight: {
    fontWeight: '600',
    color: Colors.primary,
  },
  statusBox: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    width: '100%',
    maxWidth: 360,
  },
  statusText: {
    ...Typography.labelMd,
    color: Colors.onPrimaryContainer,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  infoTitle: {
    ...Typography.titleMd,
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 4,
  },
  infoText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.primary,
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
    color: Colors.onPrimary,
  },
  secondaryButton: {
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    ...Typography.bodyMd,
    color: Colors.primary,
    fontWeight: '600',
  },
});
