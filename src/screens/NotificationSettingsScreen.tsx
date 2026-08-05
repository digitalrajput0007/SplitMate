import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import { getUserProfileFromFirestore, updateUserPreferencesInFirestore } from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

export default function NotificationSettingsScreen({ navigation }: Props) {
  const currentUser = auth.currentUser;

  const [expenseAlerts, setExpenseAlerts] = useState(true);
  const [settlementReminders, setSettlementReminders] = useState(true);
  const [monthlyDigest, setMonthlyDigest] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      getUserProfileFromFirestore(currentUser.uid).then((data) => {
        if (data?.preferences) {
          if (data.preferences.expenseAlerts !== undefined) setExpenseAlerts(data.preferences.expenseAlerts);
          if (data.preferences.settlementReminders !== undefined) setSettlementReminders(data.preferences.settlementReminders);
          if (data.preferences.monthlyDigest !== undefined) setMonthlyDigest(data.preferences.monthlyDigest);
        }
      });
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser?.uid) return;
    setSaving(true);
    try {
      await updateUserPreferencesInFirestore(currentUser.uid, {
        expenseAlerts,
        settlementReminders,
        monthlyDigest,
      });
      Alert.alert('Preferences Saved', 'Your notification settings have been updated.');
      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving notification preferences:', error);
      Alert.alert('Error', error.message || 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Notification Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Expense Push Alerts</Text>
              <Text style={styles.toggleSub}>Get notified instantly when someone adds an expense</Text>
            </View>
            <Switch
              value={expenseAlerts}
              onValueChange={setExpenseAlerts}
              trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primaryContainer }}
              thumbColor={expenseAlerts ? Colors.primary : Colors.outlineVariant}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Settlement Reminders</Text>
              <Text style={styles.toggleSub}>Remind friends about pending group balances</Text>
            </View>
            <Switch
              value={settlementReminders}
              onValueChange={setSettlementReminders}
              trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primaryContainer }}
              thumbColor={settlementReminders ? Colors.primary : Colors.outlineVariant}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Monthly Summary Digest</Text>
              <Text style={styles.toggleSub}>Receive a monthly breakdown of all group spending</Text>
            </View>
            <Switch
              value={monthlyDigest}
              onValueChange={setMonthlyDigest}
              trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primaryContainer }}
              thumbColor={monthlyDigest ? Colors.primary : Colors.outlineVariant}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.disabledButton]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.buttonText}>Save Notification Settings</Text>
            )}
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
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
    gap: Spacing.md,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  toggleTextCol: { flex: 1 },
  toggleTitle: { ...Typography.bodyLg, color: Colors.onSurface, fontWeight: '600' },
  toggleSub: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.divider },
  button: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadows.button,
  },
  disabledButton: { opacity: 0.7 },
  buttonText: { ...Typography.titleMd, color: Colors.onPrimary },
});
