import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, BorderRadius, Typography, Shadows, Colors } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { verifyOTP, sendOTPEmailHTTP } from '../services/authService';
import { MaterialIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailVerificationOTP'>;

export default function EmailVerificationOTPScreen({ navigation, route }: Props) {
  const { email = '' } = route.params || {};
  const { colors } = useTheme();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleVerify = async () => {
    setErrorMessage('');
    if (otp.length !== 6) {
      setErrorMessage('Please enter the 6-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      if (!email) throw new Error('Missing email parameter');
      await verifyOTP(email, otp);
      setLoading(false);
      Alert.alert('Success', 'Email verified successfully!', [
        { text: 'Continue', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] }) }
      ]);
    } catch (error: any) {
      setLoading(false);
      setErrorMessage(error.message || 'Verification Failed. Invalid or expired OTP.');
    }
  };

  const handleResend = async () => {
    setErrorMessage('');
    if (!email) {
      Alert.alert('Error', 'No email address found.');
      return;
    }
    setResending(true);
    try {
      await sendOTPEmailHTTP(email);
      setTimer(30);
      Alert.alert('Sent', 'A new code has been sent to your email.');
    } catch (error: any) {
      console.error("Resend OTP error:", error);
      Alert.alert('Resend Failed', error.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="mark-email-read" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.onSurface }]}>Verify Your Email</Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              Please enter the 6-digit code sent to{'\n'}
              <Text style={{ fontWeight: '700', color: colors.onSurface }}>{email || 'your email'}</Text>
            </Text>

            {!!errorMessage && (
              <View style={[styles.errorContainer, { backgroundColor: colors.errorContainer }]}>
                <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
              </View>
            )}

            <TextInput
              style={[styles.otpInput, { borderColor: colors.outlineVariant, color: colors.onSurface }]}
              value={otp}
              onChangeText={(text) => {
                setOtp(text.replace(/[^0-9]/g, ''));
                if (errorMessage) setErrorMessage('');
              }}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={colors.outline}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.verifyBtn, { backgroundColor: colors.primary }, (otp.length !== 6 || loading) && { opacity: 0.6 }]}
              onPress={handleVerify}
              disabled={loading || otp.length !== 6}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.verifyBtnText}>Verify</Text>}
            </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={[styles.resendText, { color: colors.onSurfaceVariant }]}>Didn't receive code? </Text>
              <TouchableOpacity onPress={handleResend} disabled={timer > 0 || resending}>
                <Text style={[styles.resendLink, { color: timer > 0 ? colors.outline : colors.primary }]}>
                  {timer > 0 ? `Resend in ${timer}s` : 'Resend now'}
                </Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#fff',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.card,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg
  },
  title: { ...Typography.headlineSm, fontWeight: '700', marginBottom: Spacing.xs },
  subtitle: { ...Typography.bodyMd, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
  otpInput: {
    width: '100%',
    height: 60,
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    marginBottom: Spacing.xl
  },
  verifyBtn: {
    width: '100%',
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button
  },
  verifyBtnText: { ...Typography.titleMd, color: '#FFF', fontWeight: '700' },
  resendContainer: { flexDirection: 'row', marginTop: Spacing.lg },
  resendText: { ...Typography.bodyMd },
  resendLink: { ...Typography.bodyMd, fontWeight: '700' },
  errorContainer: {
    width: '100%',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    alignItems: 'center'
  },
  errorText: { ...Typography.bodySm, textAlign: 'center' }
});
