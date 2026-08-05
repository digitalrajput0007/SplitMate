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
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import { getUserProfileFromFirestore, updateUserPreferencesInFirestore } from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

export default function NotificationSettingsScreen({ navigation }: Props) {
  const currentUser = auth.currentUser;
  const { colors, isDark } = useTheme();

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
    } catch (e) {
      console.log('Failed updating preference:', e);
      setter(!value);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Notification Settings</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          
          {/* Group Invites */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleTitle, { color: colors.onSurface }]}>Group Invitations</Text>
              <Text style={[styles.toggleSub, { color: colors.onSurfaceVariant }]}>Get notified when friends add you to a group</Text>
            </View>
            {savingKey === 'groupInvites' ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: 12 }} />
            ) : (
              <Switch
                value={groupInvites}
                onValueChange={(val) => handleToggle('groupInvites', val, setGroupInvites)}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
                thumbColor={groupInvites ? colors.primary : colors.outlineVariant}
              />
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Expense Alerts */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleTitle, { color: colors.onSurface }]}>Expense Alerts</Text>
              <Text style={[styles.toggleSub, { color: colors.onSurfaceVariant }]}>Realtime push alerts when someone adds an expense</Text>
            </View>
            {savingKey === 'expenseAlerts' ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: 12 }} />
            ) : (
              <Switch
                value={expenseAlerts}
                onValueChange={(val) => handleToggle('expenseAlerts', val, setExpenseAlerts)}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
                thumbColor={expenseAlerts ? colors.primary : colors.outlineVariant}
              />
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Settlement Reminders */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleTitle, { color: colors.onSurface }]}>Settlement Reminders</Text>
              <Text style={[styles.toggleSub, { color: colors.onSurfaceVariant }]}>Notifications when a friend records a payment</Text>
            </View>
            {savingKey === 'settlementReminders' ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: 12 }} />
            ) : (
              <Switch
                value={settlementReminders}
                onValueChange={(val) => handleToggle('settlementReminders', val, setSettlementReminders)}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
                thumbColor={settlementReminders ? colors.primary : colors.outlineVariant}
              />
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          {/* Monthly Digest */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleTitle, { color: colors.onSurface }]}>Monthly Summary Digest</Text>
              <Text style={[styles.toggleSub, { color: colors.onSurfaceVariant }]}>Receive a monthly breakdown of all group spending</Text>
            </View>
            {savingKey === 'monthlyDigest' ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: 12 }} />
            ) : (
              <Switch
                value={monthlyDigest}
                onValueChange={(val) => handleToggle('monthlyDigest', val, setMonthlyDigest)}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
                thumbColor={monthlyDigest ? colors.primary : colors.outlineVariant}
              />
            )}
          </View>

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
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    borderWidth: 1,
    gap: Spacing.md,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  toggleTextCol: { flex: 1 },
  titleWithBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  toggleTitle: { ...Typography.bodyLg, fontWeight: '600' },
  statusBadge: { ...Typography.labelMd, fontWeight: '700', marginLeft: 4 },
  toggleSub: { ...Typography.labelMd, marginTop: 2 },
  divider: { height: 1 },
});
