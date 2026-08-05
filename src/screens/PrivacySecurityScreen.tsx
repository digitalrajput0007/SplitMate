import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';

export default function PrivacySecurityScreen() {
  const navigation = useNavigation();

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
      Alert.alert('Authentication Error', e?.message || 'An error occurred during verification.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={Colors.onBackground} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Privacy & Security</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Security Options */}
        <Text style={styles.sectionTitle}>Security Controls</Text>
        <View style={styles.cardGroup}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Biometric Lock</Text>
              <Text style={styles.rowSub}>Use Fingerprint / Face ID to secure app entry</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ true: Colors.primary }}
            />
          </View>
        </View>

        {/* Account Controls */}
        <Text style={styles.sectionTitle}>Account Control</Text>
        <View style={styles.cardGroup}>
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
            <Text style={[styles.rowTitle, { color: Colors.error }]}>Delete Account</Text>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.error} strokeWidth="2">
              <Path d="M9 18l6-6-6-6" />
            </Svg>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.md },
  sectionTitle: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600', marginTop: Spacing.xs },
  cardGroup: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  rowClickable: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.gutter, minHeight: 44 },
  rowTitle: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
  rowSub: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: Spacing.sm },
});
