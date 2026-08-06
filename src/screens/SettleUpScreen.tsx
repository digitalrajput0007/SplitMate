import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth, db } from '../config/firebase';
import { getCurrencyConfig, formatCurrency } from '../services/currencyService';
import {
  subscribeToGroupExpenses,
  subscribeToGroupSettlements,
  addSettlementToFirestore,
  subscribeToGroupDetail,
  subscribeAllUserProfiles,
  sendPaymentReminder,
  canSendReminder,
  ExpenseData,
  SettlementData,
  GroupData,
  UserProfile,
} from '../services/firestoreService';
import { simplifyDebts, SimplifiedDebt } from '../services/debtSimplifier';
import {
  initializeInterstitialAd,
  showSettleUpInterstitial,
} from '../services/adMobService';
import { useTheme } from '../context/ThemeContext';
import { collection, query, where, getDocs } from 'firebase/firestore';

type Props = NativeStackScreenProps<RootStackParamList, 'SettleUp'>;

export default function SettleUpScreen({ navigation, route }: Props) {
  const { colors, isDark } = useTheme();
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || 'user_current';

  const groupId = route.params?.groupId || 'goa_trip';

  const [group, setGroup] = useState<GroupData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [settlements, setSettlements] = useState<SettlementData[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { name: string; paymentHandle?: string; photoUrl?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  useEffect(() => {
    initializeInterstitialAd();

    // 1. Subscribe to Group Detail (for Photo and Name)
    const unsubGroup = subscribeToGroupDetail(groupId, (data) => {
      setGroup(data);
    });

    // 2. Subscribe to ALL profiles for real-time resolution
    const unsubProfiles = subscribeAllUserProfiles((allUsers) => {
      const profiles: Record<string, { name: string; paymentHandle?: string; photoUrl?: string }> = {};

      allUsers.forEach((user) => {
        profiles[user.uid] = {
          name: user.uid === currentUid ? 'You' : user.name,
          paymentHandle: user.paymentHandle || '',
          photoUrl: user.photoUrl || '',
        };
      });

      if (!profiles[currentUid]) {
        profiles[currentUid] = { name: 'You', paymentHandle: '', photoUrl: '' };
      }

      setMemberProfiles(profiles);
    });

    const unsubExp = subscribeToGroupExpenses(groupId, (data) => setExpenses(data));
    const unsubSet = subscribeToGroupSettlements(groupId, (data) => {
      setSettlements(data);
      setLoading(false);
    });

    return () => {
      unsubGroup();
      unsubProfiles();
      unsubExp();
      unsubSet();
    };
  }, [groupId, currentUid]);

  const simplifiedDebts = useMemo(() => {
    return simplifyDebts(expenses, settlements, memberProfiles);
  }, [expenses, settlements, memberProfiles]);

  const totalGroupExpense = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const userTotalPaid = expenses
    .filter((e) => e.paidBy === currentUid)
    .reduce((acc, e) => acc + e.amount, 0);
  const userTotalShare = expenses.reduce((acc, e) => acc + (e.splitDetails?.[currentUid] || 0), 0);

  const userReceived = settlements
    .filter((s) => s.toUserId === currentUid && (s.status === 'completed' || !s.status))
    .reduce((acc, s) => acc + s.amount, 0);
  const userSent = settlements
    .filter((s) => s.fromUserId === currentUid && (s.status === 'completed' || !s.status))
    .reduce((acc, s) => acc + s.amount, 0);

  const netBalance = Math.round((userTotalPaid - userTotalShare + userSent - userReceived) * 100) / 100;

  const handlePayViaUPI = async (debt: SimplifiedDebt) => {
    if (!debt.toPaymentHandle) {
      Alert.alert('No UPI ID', 'This user has not added a UPI ID yet.');
      return;
    }

    const upiUrl = `upi://pay?pa=${encodeURIComponent(debt.toPaymentHandle)}&pn=${encodeURIComponent(debt.toName)}&am=${debt.amount.toFixed(2)}&cu=INR&tn=SplitMate%20Settlement`;

    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          'Pay via UPI',
          `Payee: ${debt.toName}\nUPI VPA: ${debt.toPaymentHandle}\nAmount: ${formatCurrency(debt.amount)}\n\n(No UPI app detected)`
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open UPI app.');
    }
  };

  const handleRecordSettlement = async (debt: SimplifiedDebt) => {
    setSettlingId(debt.id);
    try {
      await addSettlementToFirestore({
        groupId: groupId,
        fromUserId: debt.fromUserId,
        toUserId: debt.toUserId,
        amount: debt.amount,
        status: 'completed',
      });
      
      Alert.alert('Success', 'Settlement recorded.');
      showSettleUpInterstitial();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to record settlement.');
    } finally {
      setSettlingId(null);
    }
  };

  const handleSendReminder = async (debt: SimplifiedDebt) => {
    setRemindingId(debt.id);
    try {
      const allowed = await canSendReminder(debt.fromUserId, groupId);
      if (!allowed) {
        Alert.alert('Reminder Sent', 'Next reminder available in 24 hours.');
        return;
      }

      await sendPaymentReminder(debt.fromUserId, groupId, group?.name || 'Group', debt.amount);
      Alert.alert('Reminder Sent', `Notification sent to ${debt.fromName}.`);
    } catch (error: any) {
      Alert.alert('Error', 'Could not send reminder.');
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header with Group Photo */}
      <View style={[styles.topBar, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.headerGroupAvatar, { backgroundColor: colors.primaryFixed }]}>
            {group?.photoUrl ? (
              <Image source={{ uri: group.photoUrl }} style={styles.avatarImg} />
            ) : (
              <MaterialIcons name={group?.groupType === 'Trip' ? 'flight' : 'groups'} size={20} color={colors.primary} />
            )}
          </View>
          <View>
            <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Settle Up</Text>
            <Text style={[styles.groupSubtitle, { color: colors.onSurfaceVariant }]}>{group?.name || 'Loading...'}</Text>
          </View>
        </View>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Settlement Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <Text style={[styles.summaryTitle, { color: colors.onSurfaceVariant }]}>Group Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>Total Expense</Text>
              <Text style={[styles.summaryValue, { color: colors.onSurface }]}>{formatCurrency(totalGroupExpense)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>You Paid</Text>
              <Text style={[styles.summaryValue, { color: colors.positive }]}>{formatCurrency(userTotalPaid)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>Your Share</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>{formatCurrency(userTotalShare)}</Text>
            </View>
          </View>

          <View style={[styles.netPositionBox, { backgroundColor: netBalance >= 0 ? colors.positiveContainer : colors.errorContainer }]}>
            <Ionicons
              name={netBalance >= 0 ? "trending-up" : "trending-down"}
              size={20}
              color={netBalance >= 0 ? colors.positiveText : colors.onErrorContainer}
            />
            <Text style={[styles.netPositionText, { color: netBalance >= 0 ? colors.positiveText : colors.onErrorContainer }]}>
              {netBalance > 0.05
                ? `You should receive ${formatCurrency(Math.abs(netBalance))}`
                : netBalance < -0.05
                  ? `You owe ${formatCurrency(Math.abs(netBalance))}`
                  : 'You are all settled up!'}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Calculated Group Balances</Text>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : simplifiedDebts.length === 0 ? (
          <View style={[styles.settledCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <Text style={styles.settledEmoji}>🎉</Text>
            <Text style={[styles.settledTitle, { color: colors.onBackground }]}>All Settled Up!</Text>
            <Text style={[styles.settledSub, { color: colors.onSurfaceVariant }]}>No outstanding debts in this group.</Text>
          </View>
        ) : (
          simplifiedDebts.map((debt) => {
            const isSettling = settlingId === debt.id;
            const isReminding = remindingId === debt.id;
            const isIowe = debt.fromUserId === currentUid;
            const isOtherOwesMe = debt.toUserId === currentUid;

            if ((!isIowe && !isOtherOwesMe) || debt.amount <= 0.05) return null;

            const otherUser = isIowe
              ? { name: debt.toName, photo: debt.toPhotoUrl, handle: debt.toPaymentHandle }
              : { name: debt.fromName, photo: debt.fromPhotoUrl, handle: null };

            return (
              <View
                key={debt.id}
                style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.avatarBox, { backgroundColor: colors.primaryFixed }]}>
                    {otherUser.photo ? (
                      <Image source={{ uri: otherUser.photo }} style={styles.avatar} />
                    ) : (
                      <Text style={[styles.avatarTxt, { color: colors.primary }]}>{otherUser.name.charAt(0)}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.onSurface }]}>{otherUser.name}</Text>
                    {isIowe && otherUser.handle ? (
                      <Text style={[styles.groupName, { color: colors.primary, fontWeight: '600' }]}>
                        UPI: {otherUser.handle}
                      </Text>
                    ) : (
                      <Text style={[styles.groupName, { color: colors.onSurfaceVariant }]}>
                        {group?.name || 'Group'}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.amount, { color: isOtherOwesMe ? colors.positive : colors.error }]}>
                    {formatCurrency(debt.amount)}
                  </Text>
                </View>

                <View style={styles.actions}>
                  {isIowe ? (
                    <>
                      {otherUser.handle ? (
                        <TouchableOpacity
                          style={[styles.primaryAction, { backgroundColor: colors.primary }]}
                          onPress={() => handlePayViaUPI(debt)}
                        >
                          <MaterialIcons name="payments" size={16} color="#fff" />
                          <Text style={[styles.actionTxt, { color: '#fff' }]}>Pay via UPI</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.disabledAction, { backgroundColor: colors.surfaceContainerLow }]}>
                          <Text style={[styles.actionTxt, { color: colors.outline }]}>No UPI Available</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.primaryAction, { backgroundColor: colors.secondaryContainer }]}
                      onPress={() => handleSendReminder(debt)}
                    >
                      <MaterialIcons name="notifications-active" size={16} color={colors.onSecondaryContainer} />
                      <Text style={[styles.actionTxt, { color: colors.onSecondaryContainer }]}>Send Reminder</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.secondaryAction, { borderColor: colors.outlineVariant }]}
                    onPress={() => handleRecordSettlement(debt)}
                  >
                    <Text style={[styles.secondaryActionTxt, { color: colors.onSurface }]}>Mark Settled</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerGroupAvatar: { width: 40, height: 40, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, fontWeight: '700' },
  groupSubtitle: { ...Typography.bodySm, marginTop: -2 },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.md },
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.md,
    ...Shadows.card,
    marginTop: Spacing.md,
  },
  summaryTitle: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 1 },
  summaryGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { gap: 4 },
  summaryLabel: { ...Typography.bodySm, fontSize: 10 },
  summaryValue: { ...Typography.titleSm, fontWeight: '700' },
  netPositionBox: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.lg, gap: 8 },
  netPositionText: { ...Typography.titleSm, fontWeight: '700' },
  sectionTitle: { ...Typography.titleMd, fontWeight: '600', marginTop: Spacing.xs },
  settledCard: { borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.xs, borderWidth: 1 },
  settledEmoji: { fontSize: 36 },
  settledTitle: { ...Typography.titleMd },
  settledSub: { ...Typography.bodyMd },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
    ...Shadows.card,
    marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  avatarTxt: { ...Typography.titleMd, fontWeight: '700' },
  name: { ...Typography.titleSm, fontWeight: '700' },
  groupName: { ...Typography.bodySm, fontSize: 11 },
  amount: { ...Typography.titleMd, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  primaryAction: { flex: 1.2, height: 40, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  disabledAction: { flex: 1.2, height: 40, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  secondaryAction: { flex: 1, height: 40, borderRadius: BorderRadius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionTxt: { ...Typography.labelMd, fontWeight: '700' },
  secondaryActionTxt: { ...Typography.labelMd, fontWeight: '600' },
});
