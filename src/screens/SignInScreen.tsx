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
        const user = await signUpWithEmail(trimmedEmail, password);
        setLoading(false);

        if (ENABLE_OTP) {
          try {
            await sendOTPEmailHTTP(trimmedEmail);
          } catch (otpErr) {
            console.log('Initial OTP send failed:', otpErr);
          }
          navigation.navigate('EmailVerificationOTP', { email: user.email || trimmedEmail });
        } else {
          navigation.navigate('EmailVerification', { email: user.email || trimmedEmail });
        }
      } else {
        const user = await signInWithEmail(trimmedEmail, password);
        setLoading(false);

        // Fetch profile with fast race, fallback immediately if delayed
        getUserProfileFromFirestore(user.uid).then((prof) => {
          if (prof && prof.name && prof.paymentHandle) {
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          } else {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'ProfileSetup',
                  params: {
                    displayName: user.displayName || undefined,
                    photoURL: user.photoURL || undefined,
                  },
                },
              ],
            });
          }
        }).catch(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: 'ProfileSetup' }],
          });
        });
      }
    } catch (err: any) {
      setLoading(false);
      console.log('Firebase Auth Error:', err);
      let message = err.message || 'An error occurred during authentication.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'An account with this email already exists.';
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
      
      // Google users are automatically verified
      await setUserEmailVerifiedInFirestore(result.user.uid);

      const prof = await getUserProfileFromFirestore(result.user.uid);
      if (prof && prof.name && prof.paymentHandle) {
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      } else {
        navigation.navigate('ProfileSetup', {
          displayName: result.googleName || result.user.displayName || undefined,
          photoURL: result.googlePhoto || result.user.photoURL || undefined,
          fromGoogle: true
        });
      }
    } catch (err: any) {
      setLoading(false);
      console.log('Google Auth Error:', err);
      if (err.code !== 'SIGN_IN_CANCELLED' && err.message !== 'Sign in action cancelled') {
        navigation.navigate('ProfileSetup', { fromGoogle: true });
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Card */}
        <View style={styles.card}>
          {/* Brand Section */}
          <View style={styles.brandSection}>
            <View style={styles.logoBox}>
              <AppLogo size={44} />
            </View>
            <Text style={styles.heading}>
              {isSignUp ? 'Create account' : 'Welcome back'}
            </Text>
            <Text style={styles.subheading}>
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
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
            disabled={loading}
          >
            <View style={styles.googleIconBox}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
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
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleLink}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Legal Footnote */}
          <Text style={styles.legal}>
            By continuing, you agree to our{' '}
            <Text style={styles.legalLink}>Terms</Text>
            {' & '}
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Text>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal visible={resetModalVisible} transparent animationType="fade" onRequestClose={() => setResetModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setResetModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.resetCard}>
            <Text style={styles.resetTitle}>Reset Password</Text>
            <Text style={styles.resetSub}>Enter your registered email address to receive a password reset link.</Text>

            {!!resetSuccessMessage && (
              <View style={styles.resetSuccessBox}>
                <Text style={styles.resetSuccessText}>{resetSuccessMessage}</Text>
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
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, resetLoading && styles.disabledButton]}
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
                  <ActivityIndicator color={Colors.onPrimary} size="small" />
                ) : (
                  <Text style={styles.sendText}>Send Link</Text>
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
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
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
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoIcon: {
    fontSize: 32,
    color: Colors.onPrimaryContainer,
  },
  heading: {
    ...Typography.headlineLgMobile,
    color: Colors.onSurface,
  },
  subheading: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
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
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
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
    color: Colors.onSurface,
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
    backgroundColor: Colors.outlineVariant,
  },
  dividerText: {
    ...Typography.bodyMd,
    color: Colors.outline,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Colors.primary,
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
    color: Colors.onPrimary,
  },
  toggleRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  toggleText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  toggleLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  legalLink: {
    color: Colors.primary,
  },
  legal: {
    ...Typography.labelMd,
    color: Colors.outline,
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
    color: Colors.primary,
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
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.dialog,
  },
  resetTitle: {
    ...Typography.headlineLgMobile,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  resetSub: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.xs,
  },
  resetSuccessBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  resetSuccessText: {
    ...Typography.bodyMd,
    color: '#2E7D32',
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
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    ...Typography.titleSm,
    color: Colors.onPrimary,
    fontWeight: '600',
  },
});
