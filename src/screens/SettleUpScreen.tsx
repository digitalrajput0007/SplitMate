import React, { useEffect, useState } from 'react';
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
import { auth } from '../config/firebase';
import { getCurrencyConfig, formatCurrency } from '../services/currencyService';
import {
  subscribeToGroupExpenses,
  subscribeToGroupSettlements,
  addSettlementToFirestore,
  subscribeToGroupDetail,
  getAllUsersFromFirestore,
  sendPaymentReminder,
  canSendReminder,
  ExpenseData,
  SettlementData,
  GroupData,
} from '../services/firestoreService';
import { simplifyDebts, SimplifiedDebt } from '../services/debtSimplifier';
import {
  initializeInterstitialAd,
  showSettleUpInterstitial,
} from '../services/adMobService';
import { useTheme } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'SettleUp'>;

export default function SettleUpScreen({ navigation, route }: Props) {
  const currencyConfig = getCurrencyConfig();
  const { colors } = useTheme();
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || 'user_current';

  const groupId = route.params?.groupId || 'goa_trip';

  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [settlements, setSettlements] = useState<SettlementData[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { name: string; paymentHandle?: string; photoUrl?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  useEffect(() => {
    initializeInterstitialAd();

    const unsubGroup = subscribeToGroupDetail(groupId, async (groupData) => {
      if (groupData) {
        const allUsers = await getAllUsersFromFirestore();
        const profiles: Record<string, { name: string; paymentHandle?: string; photoUrl?: string }> = {};

        groupData.memberIds.forEach((uid) => {
          const user = allUsers.find((u) => u.uid === uid);
          if (user) {
            profiles[uid] = {
              name: uid === currentUid ? 'You' : user.name,
              paymentHandle: user.paymentHandle || '',
              photoUrl: user.photoUrl || '',
            };
          }
        });
        setMemberProfiles(profiles);
      }
    });

    const unsubExp = subscribeToGroupExpenses(groupId, (data) => setExpenses(data));
    const unsubSet = subscribeToGroupSettlements(groupId, (data) => {
      setSettlements(data);
      setLoading(false);
    });

    return () => {
      unsubGroup();
      unsubExp();
      unsubSet();
    };
  }, [groupId, currentUid]);

  const simplifiedDebts = simplifyDebts(expenses, settlements, memberProfiles);

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
    const upiUrl = `upi://pay?pa=${encodeURIComponent(debt.toPaymentHandle)}&pn=${encodeURIComponent(debt.toName)}&am=${debt.amount.toFixed(2)}&cu=INR&tn=SplitMate%20Settlement`;

    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          'Pay via UPI',
          `Payee: ${debt.toName}\nUPI VPA: ${debt.toPaymentHandle}\nAmount: ${formatCurrency(debt.amount)}\n\n(No UPI app like Google Pay, PhonePe, or Paytm detected on this device/emulator. Deep link URL:\n${upiUrl})`
        );
      }
    } catch (e) {
      Alert.alert(
        'Pay via UPI',
        `Payee: ${debt.toName}\nUPI VPA: ${debt.toPaymentHandle}\nAmount: ${formatCurrency(debt.amount)}`
      );
    }
  };

  const handleInternationalPayment = (debt: SimplifiedDebt) => {
    Alert.alert(
      'Settle Payment',
      `Transfer ${formatCurrency(debt.amount)} to ${debt.toName} via their handle:\n\n${debt.toPaymentHandle}`
    );
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
      
      Alert.alert(
        'Settlement Recorded!', 
        `Payment of ${formatCurrency(debt.amount)} from ${debt.fromName} to ${debt.toName} recorded.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Trigger Interstitial Ad after settle-up completion (max once per session)
              showSettleUpInterstitial();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error recording settlement:', error);
      Alert.alert('Error', error.message || 'Failed to record settlement.');
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

      await sendPaymentReminder(debt.fromUserId, groupId, route.params?.groupName || 'Group', debt.amount);
      Alert.alert('Reminder Sent', `A notification has been sent to ${debt.fromName}.`);
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      Alert.alert('Error', 'Could not send reminder.');
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Settle Up — Group Debts</Text>
        <View style={{ width: 40 }} />
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
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 24 }} />
        ) : simplifiedDebts.length === 0 ? (
          <View style={styles.settledCard}>
            <Text style={styles.settledEmoji}>🎉</Text>
            <Text style={styles.settledTitle}>All Settled Up!</Text>
            <Text style={styles.settledSub}>No outstanding debts in this group.</Text>
          </View>
        ) : (
          simplifiedDebts.map((debt) => {
            const isSettling = settlingId === debt.id;
            const isReminding = remindingId === debt.id;
            const isIowe = debt.fromUserId === currentUid;
            const isOtherOwesMe = debt.toUserId === currentUid;

            // Only show debts involving current user and ignore negligible balances
            if ((!isIowe && !isOtherOwesMe) || debt.amount <= 0.05) return null;

            const otherUser = isIowe
              ? { name: debt.toName, photo: debt.toPhotoUrl, handle: debt.toPaymentHandle }
              : { name: debt.fromName, photo: debt.fromPhotoUrl, handle: null };

            return (
              <View key={debt.id} style={styles.debtCard}>
                <View style={styles.debtHeaderRow}>
                  {/* Profile Photo */}
                  <View style={[styles.avatarCircle, { backgroundColor: colors.primaryFixed }]}>
                    {otherUser.photo ? (
                      <Image source={{ uri: otherUser.photo }} style={styles.avatarImg} />
                    ) : (
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {otherUser.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.debtInfo}>
                    <Text style={[styles.debtName, { color: colors.onSurface }]}>{otherUser.name}</Text>
                    <Text style={[styles.debtStatusLabel, { color: isOtherOwesMe ? colors.positive : colors.error }]}>
                      {isOtherOwesMe ? 'Owes You' : 'You Owe'}
                    </Text>
                    {isIowe && (
                      <Text style={[styles.upiSub, { color: colors.onSurfaceVariant }]}>
                        {otherUser.handle ? `UPI: ${otherUser.handle}` : 'Payment Method Not Available'}
                      </Text>
                    )}
                  </View>

                  <Text style={[styles.debtAmount, { color: isOtherOwesMe ? colors.positive : colors.error }]}>
                    {formatCurrency(debt.amount)}
                  </Text>
                </View>

                {/* Actions Row */}
                <View style={styles.actionsRow}>
                  {isIowe && otherUser.handle ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handlePayViaUPI(debt)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="logo-google-playstore" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
                      <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>Pay via UPI</Text>
                    </TouchableOpacity>
                  ) : isOtherOwesMe ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.secondaryContainer }]}
                      onPress={() => handleSendReminder(debt)}
                      activeOpacity={0.8}
                      disabled={isReminding}
                    >
                      {isReminding ? (
                        <ActivityIndicator size="small" color={colors.onSecondaryContainer} />
                      ) : (
                        <>
                          <MaterialIcons name="notifications-active" size={18} color={colors.onSecondaryContainer} style={{ marginRight: 6 }} />
                          <Text style={[styles.actionBtnText, { color: colors.onSecondaryContainer }]}>Send Reminder</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.settleBtn, { borderColor: colors.outlineVariant, borderWidth: 1 }]}
                    onPress={() => handleRecordSettlement(debt)}
                    activeOpacity={0.8}
                    disabled={isSettling}
                  >
                    {isSettling ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <Text style={[styles.settleBtnText, { color: colors.onSurface }]}>Mark as Settled</Text>
                    )}
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
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.md,
    ...Shadows.card,
    marginTop: Spacing.xs,
  },
  summaryTitle: {
    ...Typography.labelMd,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    gap: 4,
  },
  summaryLabel: {
    ...Typography.bodySm,
    fontSize: 10,
  },
  summaryValue: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
  netPositionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  netPositionText: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
  sectionTitle: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600', marginTop: Spacing.xs },
  settledCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  settledEmoji: { fontSize: 36 },
  settledTitle: { ...Typography.titleMd, color: Colors.onBackground },
  settledSub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  debtCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  debtHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { ...Typography.titleLg, fontWeight: '700' },
  debtInfo: { flex: 1 },
  debtName: { ...Typography.titleSm, fontWeight: '700' },
  debtStatusLabel: { ...Typography.labelMd, marginTop: 2 },
  upiSub: { ...Typography.bodySm, fontSize: 10, marginTop: 2 },
  debtAmount: { ...Typography.titleLg, fontWeight: '700' },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    height: 44,
  },
  actionBtnText: { ...Typography.labelLg, fontWeight: '700' },
  settleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    height: 44,
  },
  settleBtnText: { ...Typography.labelLg, fontWeight: '600' },
});
