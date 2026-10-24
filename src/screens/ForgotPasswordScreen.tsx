import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import { OutlinedInput } from '../components/OutlinedInput';
import { sendOTPEmailHTTP, resetPassword } from '../services/authService';
import { ENABLE_OTP } from '../config/appConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const dialog = useDialog();
  const initialEmail = route.params?.email || '';
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleResetRequest = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      dialog.showWarning('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setSuccessMessage('');
    try {
      if (ENABLE_OTP) {
        // mode 'reset' checks if user exists
        await sendOTPEmailHTTP(trimmedEmail, 'reset');
        setLoading(false);
        navigation.navigate('ResetPasswordOTP', { email: trimmedEmail });
      } else {
        await resetPassword(trimmedEmail);
        setLoading(false);
        setSuccessMessage('Password reset email sent! Please check your inbox.');
        dialog.showSuccess('Reset Link Sent', 'Password reset email sent! Please check your inbox.');
      }
    } catch (error: any) {
      setLoading(false);
      dialog.showError('Email Not Found', error.message || 'No account found with this email address.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
              <MaterialIcons name="lock-reset" size={48} color={colors.primary} />
            </View>

            <Text style={[styles.title, { color: colors.onSurface }]}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              {ENABLE_OTP
                ? "Enter your email and we'll send you a 6-digit code to reset your password."
                : "Enter your email and we'll send you a link to reset your password."}
            </Text>

            {!!successMessage && (
              <View style={[styles.successContainer, { backgroundColor: colors.positiveContainer }]}>
                <Text style={[styles.successText, { color: colors.positiveText }]}>{successMessage}</Text>
              </View>
            )}

            <OutlinedInput
              label="Email Address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (successMessage) setSuccessMessage('');
              }}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {(() => {
              const isSubmitDisabled = loading || !email.trim() || !email.includes('@');
              return (
                <TouchableOpacity
                  style={[
                    styles.btn,
                    { backgroundColor: colors.primary },
                    isSubmitDisabled && { opacity: 0.5 },
                  ]}
                  onPress={handleResetRequest}
                  disabled={isSubmitDisabled}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <Text style={[styles.btnText, { color: colors.onPrimary }]}>
                      {ENABLE_OTP ? 'Send Code' : 'Send Reset Link'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, padding: Spacing.lg, justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 20, left: 20, zIndex: 10 },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.card,
    borderWidth: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg
  },
  title: { ...Typography.headlineSm, fontWeight: '700', marginBottom: Spacing.xs },
  subtitle: { ...Typography.bodyMd, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
  btn: {
    width: '100%',
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadows.button
  },
  btnText: { ...Typography.titleMd, color: '#FFF', fontWeight: '700' },
  successContainer: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%'
  },
  successText: {
    color: '#2E7D32',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500'
  }
});
