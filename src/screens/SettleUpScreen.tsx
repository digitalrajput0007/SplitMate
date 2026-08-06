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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
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
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { name: string; paymentHandle?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  useEffect(() => {
    initializeInterstitialAd();

    const unsubGroup = subscribeToGroupDetail(groupId, async (groupData) => {
      if (groupData) {
        const allUsers = await getAllUsersFromFirestore();
        const profiles: Record<string, { name: string; paymentHandle?: string }> = {};

        groupData.memberIds.forEach((uid) => {
          const user = allUsers.find((u) => u.uid === uid);
          if (user) {
            profiles[uid] = {
              name: uid === currentUid ? 'You' : user.name,
              paymentHandle: user.paymentHandle || '',
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
        {/* Smart Simplification Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="auto-fix-high" size={24} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Smart Debt Simplification</Text>
            <Text style={styles.bannerSub}>
              Crisscrossing group debts are automatically combined into the minimum direct payments.
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Calculated Group Balances</Text>

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
            return (
              <View key={debt.id} style={styles.debtCard}>
                <View style={styles.debtHeaderRow}>
                  <View style={styles.avatarPair}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>{debt.fromName.charAt(0)}</Text>
                    </View>
                    <MaterialIcons name="arrow-forward" size={18} color={Colors.primary} />
                    <View style={[styles.avatarCircle, { backgroundColor: Colors.secondaryContainer }]}>
                      <Text style={[styles.avatarText, { color: Colors.onSecondaryContainer }]}>
                        {debt.toName.charAt(0)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.debtInfo}>
                    <Text style={styles.debtTitle}>
                      <Text style={{ fontWeight: '700' }}>{debt.fromName}</Text> owes{' '}
                      <Text style={{ fontWeight: '700' }}>{debt.toName}</Text>
                    </Text>
                    <Text style={styles.upiSub}>
                      {currencyConfig.isIndia ? `VPA: ${debt.toPaymentHandle}` : `Handle: ${debt.toPaymentHandle}`}
                    </Text>
                  </View>

                  <Text style={styles.debtAmount}>{formatCurrency(debt.amount)}</Text>
                </View>

                {/* Actions Row */}
                <View style={styles.actionsRow}>
                  {currencyConfig.isIndia ? (
                    <TouchableOpacity
                      style={styles.upiBtn}
                      onPress={() => handlePayViaUPI(debt)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.upiBtnIcon}>💸</Text>
                      <Text style={styles.upiBtnText}>Pay via UPI</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.upiBtn}
                      onPress={() => handleInternationalPayment(debt)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.upiBtnIcon}>💳</Text>
                      <Text style={styles.upiBtnText}>Pay via App / Bank</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.recordBtn, isSettling && styles.disabledBtn]}
                    onPress={() => handleRecordSettlement(debt)}
                    activeOpacity={0.8}
                    disabled={isSettling}
                  >
                    {isSettling ? (
                      <ActivityIndicator color={Colors.onPrimary} size="small" />
                    ) : (
                      <Text style={styles.recordBtnText}>Record Settlement</Text>
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primaryFixed,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  bannerTitle: { ...Typography.titleSm, color: Colors.onPrimaryFixed },
  bannerSub: { ...Typography.bodyMd, color: Colors.onPrimaryFixedVariant, marginTop: 2 },
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...Typography.titleSm, color: Colors.primary },
  debtInfo: { flex: 1 },
  debtTitle: { ...Typography.titleSm, color: Colors.onSurface },
  upiSub: { ...Typography.labelMd, color: Colors.onSurfaceVariant },
  debtAmount: { ...Typography.titleMd, color: Colors.primary, fontWeight: '600' },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
  },
  upiBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.secondaryContainer,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.gutter,
    minHeight: 44,
  },
  upiBtnIcon: { fontSize: 14 },
  upiBtnText: { ...Typography.titleSm, color: Colors.onSecondaryContainer },
  recordBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.gutter,
    minHeight: 44,
  },
  disabledBtn: { opacity: 0.6 },
  recordBtnText: { ...Typography.titleSm, color: Colors.onPrimary },
});
