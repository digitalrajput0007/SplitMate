import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { OutlinedInput } from '../components/OutlinedInput';
import { useTheme } from '../context/ThemeContext';
import { signUpWithEmail, signInWithEmail, signInWithGoogle, resetPassword, sendOTPEmailHTTP } from '../services/authService';
import { getUserProfileFromFirestore, setUserEmailVerifiedInFirestore } from '../services/firestoreService';
import { getCurrencyConfig } from '../services/currencyService';
import AppLogo from '../components/AppLogo';
import { Alert, Modal } from 'react-native';
import { ENABLE_OTP } from '../config/appConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  const handleContinueWithEmail = async () => {
    setErrorMessage('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Send OTP first - mode 'signup' checks if email is already taken
        await sendOTPEmailHTTP(trimmedEmail, 'signup');
        setLoading(false);
        navigation.navigate('EmailVerificationOTP', {
          email: trimmedEmail,
          password: password
        });
      } else {
        await signInWithEmail(trimmedEmail, password);
        setLoading(false);
      }
    } catch (err: any) {
      setLoading(false);
      console.log('Firebase Auth Error:', err);
      let message = err.message || 'An error occurred during authentication.';
      if (
        err.code === 'auth/email-already-in-use' ||
        message.toLowerCase().includes('already exists') ||
        message.toLowerCase().includes('bad request')
      ) {
        message = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      }
      setErrorMessage(message);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      setLoading(false);

      // Fire Firestore profile verification sync asynchronously in background without blocking navigation
      setUserEmailVerifiedInFirestore(result.user.uid).catch(e => 
        console.warn('Background Google user verification sync error:', e)
      );
    } catch (err: any) {
      setLoading(false);
      console.log('Google Auth Error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={[styles.scroll, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          {/* Brand Section */}
          <View style={styles.brandSection}>
            <View style={[styles.logoBox, { backgroundColor: colors.primaryContainer }]}>
              <AppLogo size={44} />
            </View>
            <Text style={[styles.heading, { color: colors.onSurface }]}>
              {isSignUp ? 'Create account' : 'Welcome back'}
            </Text>
            <Text style={[styles.subheading, { color: colors.onSurfaceVariant }]}>
              {isSignUp
                ? 'Start splitting smarter today.'
                : 'Sign in to manage your group expenses.'}
            </Text>
          </View>

          {/* Error Banner */}
          {!!errorMessage && (
            <View style={[styles.errorContainer, { backgroundColor: colors.errorContainer, borderColor: colors.error }]}>
              <MaterialIcons name="error-outline" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.onErrorContainer }]}>{errorMessage}</Text>
            </View>
          )}

          {/* Google Sign-In Button */}
          <TouchableOpacity
            style={[styles.googleButton, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
            disabled={loading}
          >
            <View style={styles.googleIconBox}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={[styles.googleButtonText, { color: colors.onSurface }]}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.outlineVariant }]} />
            <Text style={[styles.dividerText, { color: colors.outline }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.outlineVariant }]} />
          </View>

          {/* Inputs */}
          <OutlinedInput
            label="Email Address"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errorMessage) setErrorMessage('');
            }}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <OutlinedInput
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage('');
            }}
            placeholder="••••••••"
            secureTextEntry
          />

          {!isSignUp && (
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => {
                if (ENABLE_OTP) {
                  navigation.navigate('ForgotPassword', { email });
                } else {
                  setResetEmail(email);
                  setResetSuccessMessage('');
                  setResetModalVisible(true);
                }
              }}
            >
              <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {isSignUp && (
            <OutlinedInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="••••••••"
              secureTextEntry
            />
          )}

          {/* Primary Action Button */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]}
            onPress={handleContinueWithEmail}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                {isSignUp ? 'Create Account' : 'Continue with Email'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle Sign-In / Sign-Up */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setPassword('');
              setConfirmPassword('');
              setErrorMessage('');
            }}
          >
            <Text style={[styles.toggleText, { color: colors.onSurfaceVariant }]}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={[styles.toggleLink, { color: colors.primary }]}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Legal Footnote */}
          <Text style={[styles.legal, { color: colors.outline }]}>
            By continuing, you agree to our{' '}
            <Text style={[styles.legalLink, { color: colors.primary }]}>Terms</Text>
            {' & '}
            <Text style={[styles.legalLink, { color: colors.primary }]}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal visible={resetModalVisible} transparent animationType="fade" onRequestClose={() => setResetModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setResetModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.resetCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.resetTitle, { color: colors.onSurface }]}>Reset Password</Text>
            <Text style={[styles.resetSub, { color: colors.onSurfaceVariant }]}>Enter your registered email address to receive a password reset link.</Text>

            {!!resetSuccessMessage && (
              <View style={[styles.resetSuccessBox, { backgroundColor: colors.positiveContainer, borderColor: colors.positive }]}>
                <Text style={[styles.resetSuccessText, { color: colors.positiveText }]}>{resetSuccessMessage}</Text>
              </View>
            )}

            <OutlinedInput
              label="Email Address"
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setResetModalVisible(false)}>
                <Text style={[styles.cancelText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: colors.primary }, resetLoading && styles.disabledButton]}
                disabled={resetLoading}
                onPress={async () => {
                  if (!resetEmail.trim()) {
                    Alert.alert('Email Required', 'Please enter your email address.');
                    return;
                  }
                  setResetLoading(true);
                  try {
                    await resetPassword(resetEmail.trim());
                    setResetSuccessMessage('Password reset email sent! Please check your inbox.');
                  } catch (e: any) {
                    Alert.alert('Reset Failed', e.message || 'Unable to send reset link.');
                  } finally {
                    setResetLoading(false);
                  }
                }}
              >
                {resetLoading ? (
                  <ActivityIndicator color={colors.onPrimary} size="small" />
                ) : (
                  <Text style={[styles.sendText, { color: colors.onPrimary }]}>Send Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.xxl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    ...Shadows.card,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoIcon: {
    fontSize: 32,
  },
  heading: {
    ...Typography.headlineLgMobile,
  },
  subheading: {
    ...Typography.bodyMd,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    gap: 10,
  },
  errorText: {
    ...Typography.labelMd,
    flex: 1,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    minHeight: 48,
    paddingVertical: Spacing.gutter,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  googleIconBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  googleButtonText: {
    ...Typography.titleMd,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...Typography.bodyMd,
  },
  primaryButton: {
    width: '100%',
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    ...Shadows.button,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    ...Typography.titleMd,
  },
  toggleRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  toggleText: {
    ...Typography.bodyMd,
  },
  toggleLink: {
    fontWeight: '600',
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
  legal: {
    ...Typography.labelMd,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.sm,
    marginTop: -Spacing.xs,
  },
  forgotText: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.containerMargin,
  },
  resetCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.dialog,
  },
  resetTitle: {
    ...Typography.headlineLgMobile,
    fontWeight: '700',
  },
  resetSub: {
    ...Typography.bodyMd,
    marginBottom: Spacing.xs,
  },
  resetSuccessBox: {
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
  },
  resetSuccessText: {
    ...Typography.bodyMd,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelText: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
  sendBtn: {
    borderRadius: BorderRadius.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
});
