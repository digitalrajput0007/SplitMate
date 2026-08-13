import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useSecurity } from '../context/SecurityContext';
import { checkBiometricHardware, checkBiometricEnrolled, authenticateBiometric } from '../services/biometricService';
import { deletePinHash } from '../services/secureStorageService';
import { changeUserPassword, deleteUserAccount, reauthenticateEmailUser, reauthenticateGoogleUser } from '../services/authService';
import { auth } from '../config/firebase';

export default function PrivacySecurityScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { lockSettings, updateLockSettings } = useSecurity();
  const [authenticating, setAuthenticating] = useState(false);

  // Change Password Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [requireCurrentPassword, setRequireCurrentPassword] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Account Deletion Re-authentication State
  const [reauthModalVisible, setReauthModalVisible] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState('');

  const performAccountDeletion = async () => {
    setDeletingAccount(true);
    try {
      await deleteUserAccount();
      setDeletingAccount(false);
      Alert.alert('Account Deleted', 'Your account has been deleted successfully.');
    } catch (err: any) {
      setDeletingAccount(false);
      if (err.code === 'auth/requires-recent-login') {
        const currentUser = auth.currentUser;
        const isGoogleUser = currentUser?.providerData.some(p => p.providerId === 'google.com');

        if (isGoogleUser) {
          Alert.alert(
            'Security Re-verification Required',
            'Deleting your account is a sensitive action. Please re-authenticate with your Google account to proceed.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Re-authenticate with Google',
                onPress: async () => {
                  setDeletingAccount(true);
                  try {
                    await reauthenticateGoogleUser();
                    await deleteUserAccount();
                    setDeletingAccount(false);
                    Alert.alert('Account Deleted', 'Your account has been deleted successfully.');
                  } catch (gErr: any) {
                    setDeletingAccount(false);
                    Alert.alert(
                      'Re-authentication Failed',
                      gErr.message || 'Could not verify your identity. Please try again.'
                    );
                  }
                },
              },
            ]
          );
        } else {
          setReauthPassword('');
          setReauthError('');
          setReauthModalVisible(true);
        }
      } else {
        Alert.alert('Error Deleting Account', err.message || 'Failed to delete account. Please try again later.');
      }
    }
  };

  const handleDeleteAccount = () => {
    if (deletingAccount) return;

    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your SplitMate account? All your active groups and expense records will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: performAccountDeletion,
        },
      ]
    );
  };

  const handleReauthEmailDeletion = async () => {
    if (!reauthPassword) {
      setReauthError('Please enter your current password.');
      return;
    }

    setReauthLoading(true);
    setReauthError('');

    try {
      await reauthenticateEmailUser(reauthPassword);
      await deleteUserAccount();
      setReauthLoading(false);
      setReauthModalVisible(false);
      setReauthPassword('');
      Alert.alert('Account Deleted', 'Your account has been deleted successfully.');
    } catch (err: any) {
      setReauthLoading(false);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setReauthError('Incorrect password. Please try again.');
      } else {
        setReauthError(err.message || 'Re-authentication failed. Please try again.');
      }
    }
  };

  const handleBiometricToggle = async (val: boolean) => {
    if (authenticating) return;
    setAuthenticating(true);

    try {
      const hasHardware = await checkBiometricHardware();
      const isEnrolled = await checkBiometricEnrolled();

      if (!hasHardware || !isEnrolled) {
        setAuthenticating(false);
        Alert.alert(
          'Biometrics Unavailable',
          'Biometric authentication (Fingerprint / Face ID) is not set up or supported on this device.'
        );
        return;
      }

      const result = await authenticateBiometric(val ? 'Verify identity to enable Biometric Lock' : 'Verify identity to disable Biometric Lock');

      if (result.success) {
        await updateLockSettings({ ...lockSettings, isBiometricEnabled: val });
        Alert.alert(
          val ? 'Biometric Lock Enabled' : 'Biometric Lock Disabled',
          val
            ? 'SplitMate will now require Fingerprint / Face ID authentication whenever the app opens.'
            : 'Biometric security lock has been turned off.'
        );
      } else {
        Alert.alert('Authentication Failed', 'Identity verification failed.');
      }
    } catch (e: any) {
      Alert.alert('Authentication Error', e.message || 'Unable to authenticate with biometrics.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handlePinToggle = async (val: boolean) => {
    if (val) {
      navigation.navigate('SetupPin');
    } else {
      Alert.alert(
        'Disable PIN',
        'Are you sure you want to disable PIN lock?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              await deletePinHash();
              await updateLockSettings({ ...lockSettings, isPinEnabled: false });
            }
          }
        ]
      );
    }
  };

  const handleChangePasswordSubmit = async () => {
    setModalErrorMessage('');

    if (!currentPassword) {
      setModalErrorMessage('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setModalErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword === currentPassword) {
      setModalErrorMessage('New password must be different from current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setModalErrorMessage('New passwords do not match.');
      return;
    }

    setPasswordLoading(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setPasswordLoading(false);
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Your password has been changed successfully.');
    } catch (err: any) {
      setPasswordLoading(false);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.message?.toLowerCase().includes('password')) {
        setModalErrorMessage('Incorrect current password. Please try again.');
      } else if (err.code === 'auth/weak-password') {
        setModalErrorMessage('New password should be at least 6 characters.');
      } else {
        setModalErrorMessage(err.message || 'Failed to change password. Please check your credentials.');
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Privacy & Security</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Security Section */}
        <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>App Lock</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Biometric Lock</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceVariant }]}>Use Face ID or Fingerprint</Text>
            </View>
            <Switch
              value={lockSettings.isBiometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
              thumbColor={lockSettings.isBiometricEnabled ? colors.primary : colors.outline}
              disabled={authenticating}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>PIN Lock</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceVariant }]}>Use a numeric PIN</Text>
            </View>
            <Switch
              value={lockSettings.isPinEnabled}
              onValueChange={handlePinToggle}
              trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
              thumbColor={lockSettings.isPinEnabled ? colors.primary : colors.outline}
            />
          </View>

          {lockSettings.isPinEnabled && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.divider }]} />
              <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('SetupPin')}>
                <Text style={[styles.rowTitle, { color: colors.primary }]}>Change PIN</Text>
                <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Account Controls */}
        <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Account Control</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <TouchableOpacity
            style={styles.rowClickable}
            onPress={() => {
              setModalErrorMessage('');
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setShowCurrentPassword(false);
              setShowNewPassword(false);
              setShowConfirmPassword(false);
              setPasswordModalVisible(true);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Change Password</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceVariant }]}>Update your account password</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity
            style={styles.rowClickable}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.error }]}>Delete Account</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceVariant }]}>Permanently delete your account & data</Text>
            </View>
            {deletingAccount ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <MaterialIcons name="chevron-right" size={24} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>

        {/* Legal Policies */}
        <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Legal & Policies</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <TouchableOpacity
            style={styles.rowClickable}
            onPress={() => Linking.openURL('https://www.fyndralabs.com/products/splitmate/privacy')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Privacy Policy</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceVariant }]}>Read our data & privacy policy</Text>
            </View>
            <MaterialIcons name="open-in-new" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity
            style={styles.rowClickable}
            onPress={() => Linking.openURL('https://www.fyndralabs.com/products/splitmate/terms')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Terms of Service</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceVariant }]}>Read our terms and conditions</Text>
            </View>
            <MaterialIcons name="open-in-new" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {!!modalErrorMessage && (
              <View style={[styles.errorBanner, { backgroundColor: colors.errorContainer }]}>
                <MaterialIcons name="error-outline" size={16} color={colors.error} />
                <Text style={[styles.errorBannerText, { color: colors.onErrorContainer }]}>{modalErrorMessage}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Current Password</Text>
              <View style={[styles.modalInputWrapper, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <TextInput
                  style={[styles.modalTextInputInner, { color: colors.onSurface }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.outline}
                  secureTextEntry={!showCurrentPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons
                    name={showCurrentPassword ? "visibility" : "visibility-off"}
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>New Password</Text>
              <View style={[styles.modalInputWrapper, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <TextInput
                  style={[styles.modalTextInputInner, { color: colors.onSurface }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.outline}
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons
                    name={showNewPassword ? "visibility" : "visibility-off"}
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Confirm New Password</Text>
              <View style={[styles.modalInputWrapper, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <TextInput
                  style={[styles.modalTextInputInner, { color: colors.onSurface }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor={colors.outline}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons
                    name={showConfirmPassword ? "visibility" : "visibility-off"}
                    size={20}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.outlineVariant }]}
                onPress={() => setPasswordModalVisible(false)}
                disabled={passwordLoading}
              >
                <Text style={[styles.modalCancelText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }, passwordLoading && { opacity: 0.6 }]}
                onPress={handleChangePasswordSubmit}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.modalSubmitText, { color: colors.onPrimary }]}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Re-authentication Modal for Account Deletion */}
      <Modal
        visible={reauthModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!reauthLoading) setReauthModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Confirm Your Identity</Text>
              <TouchableOpacity
                onPress={() => !reauthLoading && setReauthModalVisible(false)}
                style={styles.modalCloseBtn}
                disabled={reauthLoading}
              >
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, marginBottom: Spacing.md }]}>
              Deleting your account requires recent sign-in verification. Please enter your current password to confirm permanent deletion.
            </Text>

            {!!reauthError && (
              <View style={[styles.errorBanner, { backgroundColor: colors.errorContainer, marginBottom: Spacing.md }]}>
                <MaterialIcons name="error-outline" size={16} color={colors.error} />
                <Text style={[styles.errorBannerText, { color: colors.onErrorContainer }]}>{reauthError}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Current Password</Text>
              <View style={[styles.modalInputWrapper, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                <TextInput
                  style={[styles.modalTextInputInner, { color: colors.onSurface }]}
                  value={reauthPassword}
                  onChangeText={setReauthPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={colors.outline}
                  secureTextEntry={!showReauthPassword}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowReauthPassword(!showReauthPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons
                    name={showReauthPassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={colors.outline}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.outlineVariant }]}
                onPress={() => setReauthModalVisible(false)}
                disabled={reauthLoading}
              >
                <Text style={[styles.modalCancelText, { color: colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: colors.error }, reauthLoading && { opacity: 0.6 }]}
                onPress={handleReauthEmailDeletion}
                disabled={reauthLoading}
              >
                {reauthLoading ? (
                  <ActivityIndicator size="small" color={colors.onError} />
                ) : (
                  <Text style={[styles.modalSubmitText, { color: colors.onError }]}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.md },
  sectionTitle: { ...Typography.titleSm, fontWeight: '600', marginTop: Spacing.xs },
  cardGroup: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  rowClickable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.gutter, minHeight: 44 },
  rowTitle: { ...Typography.titleSm, fontWeight: '600' },
  rowSub: { ...Typography.labelMd, marginTop: 2 },
  divider: { height: 1, marginVertical: Spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.md,
    ...Shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorBannerText: {
    ...Typography.bodySm,
    flex: 1,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    ...Typography.labelMd,
    fontWeight: '600',
  },
  modalInputWrapper: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTextInputInner: {
    flex: 1,
    height: '100%',
    ...Typography.bodyMd,
    paddingRight: Spacing.xs,
  },
  eyeBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
});
