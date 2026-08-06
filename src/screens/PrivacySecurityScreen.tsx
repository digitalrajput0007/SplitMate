import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useSecurity } from '../context/SecurityContext';
import { checkBiometricHardware, checkBiometricEnrolled, authenticateBiometric } from '../services/biometricService';
import { deletePinHash } from '../services/secureStorageService';

export default function PrivacySecurityScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { lockSettings, updateLockSettings } = useSecurity();
  const [authenticating, setAuthenticating] = useState(false);

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

  const updateTimeout = (seconds: number) => {
    updateLockSettings({ ...lockSettings, lockTimeout: seconds });
  };

  const TIMEOUTS = [
    { label: 'Instantly', value: 0 },
    { label: '30 Seconds', value: 30 },
    { label: '1 Minute', value: 60 },
    { label: '5 Minutes', value: 300 },
  ];

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

        <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Auto-Lock Timeout</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          {TIMEOUTS.map((t, idx) => (
            <React.Fragment key={t.value}>
              <TouchableOpacity style={styles.row} onPress={() => updateTimeout(t.value)}>
                <Text style={[styles.rowTitle, { color: colors.onSurface, fontWeight: lockSettings.lockTimeout === t.value ? '700' : '500' }]}>
                  {t.label}
                </Text>
                {lockSettings.lockTimeout === t.value && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
              {idx < TIMEOUTS.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </React.Fragment>
          ))}
        </View>

        {/* Account Controls */}
        <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Account Control</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <TouchableOpacity
            style={styles.rowClickable}
            onPress={() =>
              Alert.alert(
                'Delete Account',
                'Are you sure you want to permanently delete your SplitMate account? All your active groups and expense records will be deleted.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete Permanently', style: 'destructive' },
                ]
              )
            }
          >
            <Text style={[styles.rowTitle, { color: colors.error }]}>Delete Account</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.error} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
});
