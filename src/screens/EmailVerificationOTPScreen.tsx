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
import { useSecurity } from '../context/SecurityContext';
import { verifyOTP, sendOTPEmailHTTP, signOutUser, signUpWithEmail, signInWithEmail, warmUpOTPService, resolveAuthenticatedUser } from '../services/authService';
import { setUserEmailVerifiedInFirestore } from '../services/firestoreService';
import { auth } from '../config/firebase';
import { MaterialIcons } from '@expo/vector-icons';
import { OTPInputBlocks } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'EmailVerificationOTP'>;

export default function EmailVerificationOTPScreen({ navigation, route }: Props) {
  const { email = '' } = route.params || {};
  const { colors } = useTheme();
  const { setIsUnlocked } = useSecurity();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const [resending, setResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Pre-warm OTP backend on mount to eliminate cold-start latency
  useEffect(() => {
    warmUpOTPService();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const isVerifyingRef = React.useRef(false);

  const handleVerify = async (codeToVerify?: string) => {
    if (isVerifyingRef.current) return;
    const targetOtp = codeToVerify || otp;
    setErrorMessage('');
    if (targetOtp.length !== 6) {
      setErrorMessage('Please enter the 6-digit code sent to your email.');
      return;
    }

    isVerifyingRef.current = true;
    setLoading(true);

    try {
      if (!email) throw new Error('Missing email parameter');
      const password = (route.params as any)?.password;

      // 1. Verify OTP
      await verifyOTP(email, targetOtp);

      // 2. Handle User Sign Up / Sign In
      let activeUser = auth.currentUser;

      if (password) {
        try {
          console.log("[Auth] OTP verified, creating user account...");
          activeUser = await signUpWithEmail(email, password);
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            console.log("[Auth] Account already exists for email, signing in...");
            activeUser = await signInWithEmail(email, password);
          } else {
            throw authErr;
          }
        }
      } else if (activeUser) {
        setUserEmailVerifiedInFirestore(activeUser.uid).catch(e =>
          console.warn('Background verification sync error:', e)
        );
      }

      setIsUnlocked(true);

      // 3. Shared canonical post-authentication resolver
      if (activeUser) {
        await resolveAuthenticatedUser(activeUser, { navigation });
      }
    } catch (error: any) {
      isVerifyingRef.current = false;
      setLoading(false);
      let userFriendlyMessage = 'Verification failed. Please check the code and try again.';
      if (error.message && (error.message.includes('Invalid OTP') || error.message.includes('400'))) {
        userFriendlyMessage = 'Invalid verification code. Please check your email and try again.';
      } else if (error.code === 'auth/email-already-in-use') {
        userFriendlyMessage = 'An account with this email already exists. Please sign in instead.';
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        userFriendlyMessage = 'Incorrect password. Please check your credentials.';
      } else if (error.code === 'auth/user-not-found') {
        userFriendlyMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/weak-password') {
        userFriendlyMessage = 'Password must be at least 8 characters long and include numbers, letters, and special characters.';
      } else if (error.message) {
        userFriendlyMessage = error.message.replace(/^Firebase:\s*Error\s*\(auth\/[^)]+\)\.?\s*/i, '');
      }
      setErrorMessage(userFriendlyMessage);
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
      const isSignup = !!(route.params as any)?.password;
      await sendOTPEmailHTTP(email, isSignup ? 'signup' : 'none');
      setTimer(30);
      Alert.alert('Sent', 'A new code has been sent to your email.');
    } catch (error: any) {
      console.error("Resend OTP error:", error);
      Alert.alert('Resend Failed', error.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      // If we're at the root of this stack (unverified user state),
      // "Back" should probably sign out the user so they can try a different email.
      Alert.alert(
        'Cancel Verification',
        'Are you sure you want to cancel and go back to sign in? This will sign you out.',
        [
          { text: 'Wait', style: 'cancel' },
          {
            text: 'Yes, Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                console.log("[Auth] Manually signing out from OTP screen...");
                await signOutUser();
                // Forces AppNavigator to reset
              } catch (e) {
                console.error("[Auth] Sign out error:", e);
              }
            }
          }
        ]
      );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
              <MaterialIcons name="mark-email-read" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.onSurface }]}>Verify Your Email</Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              Please enter the 6-digit code sent to{'\n'}
              <Text style={{ fontWeight: '700', color: colors.onSurface }}>{email || 'your email'}</Text>
            </Text>

            <View style={{ minHeight: 44, justifyContent: 'center', marginBottom: 12 }}>
              {!!errorMessage && (
                <View style={[styles.errorContainer, { backgroundColor: colors.errorContainer, marginTop: 0 }]}>
                  <Text style={[styles.errorText, { color: colors.error }]}>{errorMessage}</Text>
                </View>
              )}
            </View>

            <OTPInputBlocks
              value={otp}
              onChange={(text) => {
                setOtp(text);
                if (errorMessage) setErrorMessage('');
              }}
              onComplete={(code) => {
                handleVerify(code);
              }}
              disabled={loading}
            />

            <TouchableOpacity
              style={[styles.verifyBtn, { backgroundColor: colors.primary }, (otp.length !== 6 || loading) && { opacity: 0.6 }]}
              onPress={() => handleVerify()}
              disabled={loading || otp.length !== 6}
            >
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.verifyBtnText, { color: colors.onPrimary }]}>Verify</Text>}
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
