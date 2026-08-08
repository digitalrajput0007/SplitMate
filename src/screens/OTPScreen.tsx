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
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { verifyOTP, sendOTPEmailHTTP } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'OTPScreen'>;

export default function OTPScreen({ navigation, route }: Props) {
  const { email = '' } = route.params || {};
  const { colors } = useTheme();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [resending, setResending] = useState(false);

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
    if (otp.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      console.log(`[UI] Verifying OTP for: ${email}`);
      await verifyOTP(email, otp);
      setLoading(false);
      // Success - go to reset password
      navigation.navigate('ResetPasswordScreen', { email });
    } catch (error: any) {
      setLoading(false);
      console.error('[UI] Verification failed:', error);
      Alert.alert('Verification Failed', error.message || 'Invalid or expired OTP.');
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await sendOTPEmailHTTP(email);
      setTimer(30);
      Alert.alert('Sent', 'A new code has been sent to your email.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code.');
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
              <MaterialIcons name="security" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.onSurface }]}>Verify Code</Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={{ fontWeight: '700', color: colors.onSurface }}>{email}</Text>
            </Text>

            <TextInput
              style={[styles.otpInput, { borderColor: colors.outlineVariant, color: colors.onSurface }]}
              value={otp}
              onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={colors.outline}
              autoFocus
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.verifyBtn, { backgroundColor: colors.primary }, (otp.length !== 6 || loading) && { opacity: 0.6 }]}
              onPress={handleVerify}
              disabled={loading || otp.length !== 6}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.verifyBtnText}>Verify & Continue</Text>}
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
});
