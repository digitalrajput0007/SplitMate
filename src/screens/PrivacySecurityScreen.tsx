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
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export default function PrivacySecurityScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  const handleBiometricToggle = async (val: boolean) => {
    if (authenticating) return;
    setAuthenticating(true);

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setAuthenticating(false);
        Alert.alert(
          'Biometrics Unavailable',
          'Biometric authentication (Fingerprint / Face ID) is not set up or supported on this device.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: val ? 'Verify identity to enable Biometric Lock' : 'Verify identity to disable Biometric Lock',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      setAuthenticating(false);

      if (result.success) {
        setBiometricEnabled(val);
        Alert.alert(
          val ? 'Biometric Lock Enabled' : 'Biometric Lock Disabled',
          val
            ? 'SplitMate will now require Fingerprint / Face ID authentication whenever the app opens.'
            : 'Biometric security lock has been turned off.'
        );
      } else {
        Alert.alert('Authentication Failed', 'Identity verification failed. Biometric settings remain unchanged.');
      }
    } catch (e: any) {
      setAuthenticating(false);
      Alert.alert('Authentication Error', e.message || 'Unable to authenticate with biometrics.');
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
        <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>App Security</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={[styles.rowTitle, { color: colors.onSurface }]}>Biometric Lock (Face ID / Touch ID)</Text>
              <Text style={[styles.rowSub, { color: colors.onSurfaceVariant }]}>Require fingerprint or face recognition to unlock SplitMate</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
              thumbColor={biometricEnabled ? colors.primary : colors.outline}
              disabled={authenticating}
            />
          </View>
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
  sectionTitle: { ...Typography.titleMd, fontWeight: '600', marginTop: Spacing.xs },
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
