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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { OutlinedInput } from '../components/OutlinedInput';
import { useTheme } from '../context/ThemeContext';
import { useSecurity } from '../context/SecurityContext';
import { signUpWithEmail, signInWithEmail, signInWithGoogle, resetPassword, sendOTPEmailHTTP } from '../services/authService';
import { getUserProfileFromFirestore, setUserEmailVerifiedInFirestore, saveUserProfileToFirestore } from '../services/firestoreService';
import { getCurrencyConfig } from '../services/currencyService';
import AppLogo from '../components/AppLogo';
import { Alert, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ENABLE_OTP } from '../config/appConfig';

function GoogleLogoSvg({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.17 0 9.99 0 12s.46 3.83 1.26 5.42l4.02-3.15z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </Svg>
  );
}

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { setIsUnlocked } = useSecurity();
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

  const isPasswordValid = (pass: string) => {
    return (
      pass.length >= 8 &&
      /[0-9]/.test(pass) &&
      /[A-Za-z]/.test(pass) &&
      /[^A-Za-z0-9]/.test(pass)
    );
  };

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[A-Za-z]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score; // 0 to 4
  };

  const handleContinueWithEmail = async () => {
    setErrorMessage('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    if (isSignUp) {
      if (!isPasswordValid(password)) {
        setErrorMessage(
          'Password must be at least 8 characters long and include numbers, letters, and special characters.'
        );
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        if (ENABLE_OTP) {
          await sendOTPEmailHTTP(trimmedEmail, 'signup');
          setLoading(false);
          navigation.navigate('EmailVerificationOTP', {
            email: trimmedEmail,
            password: password
          });
          return;
        }

        // Direct Firebase Sign-up Fallback (If ENABLE_OTP is false)
        await signUpWithEmail(trimmedEmail, password);
        setIsUnlocked(true);
        setLoading(false);
      } else {
        await signInWithEmail(trimmedEmail, password);
        setIsUnlocked(true);
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
      
      if (!result) {
        setLoading(false);
        return;
      }

      setIsUnlocked(true);
      setLoading(false);

      // Fire Firestore profile verification sync asynchronously in background without blocking navigation
      (async () => {
        try {
          await setUserEmailVerifiedInFirestore(result.user.uid);
        } catch (e) {
          console.warn('Background Google user verification/profile sync error:', e);
        }
      })();
    } catch (err: any) {
      setLoading(false);
      console.log('Google Auth Error:', err);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
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
              <View style={[styles.brandTag, { backgroundColor: colors.primaryContainer }]}>
                <Text style={[styles.brandTagText, { color: colors.primary }]}>FYNDRA LABS</Text>
                <Text style={[styles.brandDot, { color: colors.primary }]}>•</Text>
                <Text style={[styles.brandTagSub, { color: colors.primary }]}>Spend, Split, Settle.</Text>
              </View>
              <Text style={[styles.heading, { color: colors.onSurface }]}>
                {isSignUp ? 'Create account' : 'Welcome back'}
              </Text>
              <Text style={[styles.subheading, { color: colors.onSurfaceVariant }]}>
                {isSignUp
                  ? 'Start splitting smarter with your friends today.'
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
              <GoogleLogoSvg size={20} />
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
              placeholder="Enter your email"
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

            {isSignUp && password.length > 0 && (() => {
              const score = getPasswordStrength(password);
              const hasMinLen = password.length >= 8;
              const hasNum = /[0-9]/.test(password);
              const hasAlpha = /[A-Za-z]/.test(password);
              const hasSpec = /[^A-Za-z0-9]/.test(password);

              const getBarColor = () => {
                if (score <= 1) return colors.error || '#EF4444';
                if (score <= 3) return colors.tertiary || '#F59E0B';
                return colors.primary || '#10B981';
              };

              return (
                <View style={styles.passwordStrengthContainer}>
                  {/* Progress Bar */}
                  <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceContainerHigh || '#E5E7EB' }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${(score / 4) * 100}%`,
                          backgroundColor: getBarColor(),
                        },
                      ]}
                    />
                  </View>

                  {/* Requirements checklist */}
                  <View style={styles.requirementsContainer}>
                    <Text style={[styles.reqText, { color: hasMinLen ? (colors.primary || '#10B981') : colors.onSurfaceVariant }]}>
                      {hasMinLen ? '✓' : '•'} At least 8 characters
                    </Text>
                    <Text style={[styles.reqText, { color: hasAlpha ? (colors.primary || '#10B981') : colors.onSurfaceVariant }]}>
                      {hasAlpha ? '✓' : '•'} Contains a letter
                    </Text>
                    <Text style={[styles.reqText, { color: hasNum ? (colors.primary || '#10B981') : colors.onSurfaceVariant }]}>
                      {hasNum ? '✓' : '•'} Contains a number
                    </Text>
                    <Text style={[styles.reqText, { color: hasSpec ? (colors.primary || '#10B981') : colors.onSurfaceVariant }]}>
                      {hasSpec ? '✓' : '•'} Contains a special character
                    </Text>
                  </View>
                </View>
              );
            })()}

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
            {(() => {
              const isSubmitDisabled = loading || !email.trim() || !password || (isSignUp && (!confirmPassword || !isPasswordValid(password) || password !== confirmPassword));
              return (
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    { backgroundColor: colors.primary },
                    isSubmitDisabled && styles.disabledButton,
                  ]}
                  onPress={handleContinueWithEmail}
                  activeOpacity={0.85}
                  disabled={isSubmitDisabled}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                      {isSignUp ? 'Create Account' : 'Login'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })()}

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
              <Text
                style={[styles.legalLink, { color: colors.primary }]}
                onPress={() => Linking.openURL('https://www.fyndralabs.com/products/splitmate/terms')}
              >
                Terms
              </Text>
              {' & '}
              <Text
                style={[styles.legalLink, { color: colors.primary }]}
                onPress={() => Linking.openURL('https://www.fyndralabs.com/products/splitmate/privacy')}
              >
                Privacy Policy
              </Text>
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
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setResetModalVisible(false)}>
                  <Text style={[styles.cancelText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    { backgroundColor: colors.primary },
                    (resetLoading || !resetEmail.trim() || !resetEmail.includes('@')) && styles.disabledButton,
                  ]}
                  disabled={resetLoading || !resetEmail.trim() || !resetEmail.includes('@')}
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
    marginBottom: Spacing.sm,
  },
  brandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
    gap: 6,
  },
  brandTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  brandDot: {
    fontSize: 10,
    fontWeight: '700',
  },
  brandTagSub: {
    fontSize: 11,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '700',
  },
  toggleRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: 4,
  },
  toggleText: {
    ...Typography.bodyMd,
    textAlign: 'center',
  },
  toggleLink: {
    ...Typography.bodyMd,
    fontWeight: '700',
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
    paddingVertical: 4,
    paddingHorizontal: 4,
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
  passwordStrengthContainer: {
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
    width: '100%',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  requirementsContainer: {
    flexDirection: 'column',
    gap: 2,
    marginTop: 4,
  },
  reqText: {
    ...Typography.labelMd,
    fontSize: 12,
  },
});
