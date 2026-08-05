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

  const [groupInvites, setGroupInvites] = useState(true);
  const [expenseAlerts, setExpenseAlerts] = useState(true);
  const [settlementReminders, setSettlementReminders] = useState(true);
  const [monthlyDigest, setMonthlyDigest] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.uid) {
      getUserProfileFromFirestore(currentUser.uid)
        .then((data) => {
          if (data?.preferences) {
            if (data.preferences.groupInvites !== undefined) setGroupInvites(data.preferences.groupInvites);
            if (data.preferences.expenseAlerts !== undefined) setExpenseAlerts(data.preferences.expenseAlerts);
            if (data.preferences.settlementReminders !== undefined) setSettlementReminders(data.preferences.settlementReminders);
            if (data.preferences.monthlyDigest !== undefined) setMonthlyDigest(data.preferences.monthlyDigest);
          }
        })
        .catch(() => {
          Alert.alert('Error', 'Network error, check your connection');
        });
    }
  }, [currentUser]);

  const handleToggle = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    if (!currentUser?.uid) return;
    setter(value);
    setSavingKey(key);

    const updated = {
      groupInvites: key === 'groupInvites' ? value : groupInvites,
      expenseAlerts: key === 'expenseAlerts' ? value : expenseAlerts,
      settlementReminders: key === 'settlementReminders' ? value : settlementReminders,
      monthlyDigest: key === 'monthlyDigest' ? value : monthlyDigest,
    };

    try {
      await updateUserPreferencesInFirestore(currentUser.uid, updated);
    } catch (error: any) {
      console.error('Error saving notification preferences:', error);
      // Revert state on error
      setter(!value);
      Alert.alert('Error', 'Couldn\'t save settings, please try again');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Notification Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>

          {/* Group Invitations */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Group invitations</Text>
              <Text style={styles.toggleSub}>Get notified when added to a group</Text>
            </View>
            {savingKey === 'groupInvites' ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginHorizontal: 12 }} />
            ) : (
              <Switch
                value={groupInvites}
                onValueChange={(val) => handleToggle('groupInvites', val, setGroupInvites)}
                trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primaryContainer }}
                thumbColor={groupInvites ? Colors.primary : Colors.outlineVariant}
              />
            )}
          </View>

          <View style={styles.divider} />

          {/* Expense Push Alerts */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Expense Push Alerts</Text>
              <Text style={styles.toggleSub}>Get notified instantly when someone adds an expense</Text>
            </View>
            {savingKey === 'expenseAlerts' ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginHorizontal: 12 }} />
            ) : (
              <Switch
                value={expenseAlerts}
                onValueChange={(val) => handleToggle('expenseAlerts', val, setExpenseAlerts)}
                trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primaryContainer }}
                thumbColor={expenseAlerts ? Colors.primary : Colors.outlineVariant}
              />
            )}
          </View>

          <View style={styles.divider} />

          {/* Settlement Reminders */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Settlement Reminders</Text>
              <Text style={styles.toggleSub}>Remind friends about pending group balances</Text>
            </View>
            {savingKey === 'settlementReminders' ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginHorizontal: 12 }} />
            ) : (
              <Switch
                value={settlementReminders}
                onValueChange={(val) => handleToggle('settlementReminders', val, setSettlementReminders)}
                trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primaryContainer }}
                thumbColor={settlementReminders ? Colors.primary : Colors.outlineVariant}
              />
            )}
          </View>

          <View style={styles.divider} />

          {/* Monthly Digest */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Monthly Summary Digest</Text>
              <Text style={styles.toggleSub}>Receive a monthly breakdown of all group spending</Text>
            </View>
            {savingKey === 'monthlyDigest' ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginHorizontal: 12 }} />
            ) : (
              <Switch
                value={monthlyDigest}
                onValueChange={(val) => handleToggle('monthlyDigest', val, setMonthlyDigest)}
                trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primaryContainer }}
                thumbColor={monthlyDigest ? Colors.primary : Colors.outlineVariant}
              />
            )}
          </View>

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
  titleWithBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  toggleTitle: { ...Typography.bodyLg, color: Colors.onSurface, fontWeight: '600' },
  statusBadge: { ...Typography.labelMd, fontWeight: '700', marginLeft: 4 },
  toggleSub: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.divider },
});
