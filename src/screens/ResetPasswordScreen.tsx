import React, { useState } from 'react';
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
import { resetPasswordWithOTP } from '../services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPasswordScreen'>;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { email = '' } = route.params || {};
  const { colors } = useTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      console.log(`[UI] Resetting password for: ${email}`);
      await resetPasswordWithOTP(email, password);
      setLoading(false);
      Alert.alert('Success', 'Your password has been reset successfully.', [
        { text: 'Login Now', onPress: () => navigation.navigate('SignIn') }
      ]);
    } catch (error: any) {
      setLoading(false);
      console.error('[UI] Password reset failed:', error);
      Alert.alert('Error', error.message || 'Failed to reset password. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.primaryContainer }]}>
              <MaterialIcons name="lock" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.onSurface }]}>New Password</Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              Set a strong password for your account.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>New Password</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.outlineVariant, color: colors.onSurface }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={colors.outline}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Confirm Password</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.outlineVariant, color: colors.onSurface }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={colors.outline}
                editable={!loading}
              />
            </View>

            {(() => {
              const isSubmitDisabled = loading || !password || !confirmPassword || password.length < 8 || password !== confirmPassword || !/[0-9]/.test(password) || !/[A-Za-z]/.test(password) || !/[^A-Za-z0-9]/.test(password);
              return (
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.primary }, isSubmitDisabled && { opacity: 0.5 }]}
                  onPress={handleReset}
                  disabled={isSubmitDisabled}
                >
                  {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.btnText, { color: colors.onPrimary }]}>Reset Password</Text>}
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
  inputGroup: { width: '100%', marginBottom: Spacing.md },
  label: { ...Typography.labelMd, marginBottom: 8, fontWeight: '600' },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  btn: {
    width: '100%',
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    ...Shadows.button
  },
  btnText: { ...Typography.titleMd, color: '#FFF', fontWeight: '700' },
});
