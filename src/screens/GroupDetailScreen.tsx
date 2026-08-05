import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  subscribeToGroupExpenses,
  subscribeToGroupDetail,
  getUserProfileFromFirestore,
  ExpenseData,
  GroupData,
  UserProfile,
} from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ navigation, route }: Props) {
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || 'user_current';

  const groupId = route.params?.groupId || 'goa_trip';

  const [group, setGroup] = useState<GroupData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.uid) {
      getUserProfileFromFirestore(currentUser.uid).then((prof) => {
        if (prof) setUserProfile(prof);
      });
    }
  }, [currentUser]);

  useEffect(() => {
    const unsubGroup = subscribeToGroupDetail(groupId, (data) => {
      if (data) setGroup(data);
    });

    const unsubExpenses = subscribeToGroupExpenses(groupId, (expList) => {
      setExpenses(expList);
      setLoading(false);
    });

    return () => {
      unsubGroup();
      unsubExpenses();
    };
  }, [groupId]);

  const groupTitle = group?.name || route.params?.groupName || 'Trip to Goa';

  // Calculate Balances with joinedAt and includeExistingExpenses filtering
  let totalGroupSpent = 0;
  let userTotalPaid = 0;
  let userTotalOwedShare = 0;

  const myJoinedAt = group?.membersJoinedAt?.[currentUid];
  const myIncludeExisting = group?.memberExistingExpensesPreference?.[currentUid] ?? true;

  expenses.forEach((exp) => {
    totalGroupSpent += exp.amount;

    const expTime = exp.createdAt?.seconds ? exp.createdAt.seconds * 1000 : Date.now();

    // Skip retroactive share calculation if user joined with "new only" mode
    if (!myIncludeExisting && myJoinedAt && expTime < myJoinedAt) {
      return;
    }

    if (exp.paidBy === currentUid) {
      userTotalPaid += exp.amount;
    }

    const myShare = exp.splitDetails?.[currentUid] || 0;
    userTotalOwedShare += myShare;
  });

  const netBalance = userTotalPaid - userTotalOwedShare;
  const isOwed = netBalance >= 0;

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <SafeAreaView style={styles.container}>
      <RNStatusBar backgroundColor={Colors.background} barStyle="dark-content" translucent />

      {/* Top Bar matching Stitch: Back button, Title, User Avatar right */}
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{groupTitle}</Text>
        <TouchableOpacity
          style={styles.avatarBtn}
          onPress={() => navigation.navigate('GroupSettings', { groupId })}
          activeOpacity={0.8}
        >
          {userProfile?.photoUrl ? (
            <Image source={{ uri: userProfile.photoUrl }} style={styles.topAvatarImg} />
          ) : (
            <View style={styles.topAvatarFallback}>
              <Text style={styles.topAvatarText}>
                {(userProfile?.name || currentUser?.displayName || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stitch Group Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL GROUP SPEND</Text>
          <Text style={styles.summaryTotalAmount}>{formatCurrency(totalGroupSpent)}</Text>
          <Text style={styles.summarySubtext}>
            {netBalance === 0 ? (
              'You are all settled up in this group.'
            ) : isOwed ? (
              <Text style={{ color: Colors.primary, fontWeight: '600' }}>
                You are owed {formatCurrency(netBalance)} overall in this group.
              </Text>
            ) : (
              <Text style={{ color: Colors.onSurfaceVariant }}>
                You owe <Text style={{ color: Colors.error, fontWeight: '600' }}>{formatCurrency(Math.abs(netBalance))}</Text> overall in this group.
              </Text>
            )}
          </Text>

          {/* Stitch Quick Action Row: (+) Icon button & Settle Up pill */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.addBtnCircle}
              onPress={() => navigation.navigate('AddExpense', { groupId, groupName: groupTitle })}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={26} color={Colors.onPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settleUpPillBtn}
              onPress={() => navigation.navigate('SettleUp', { groupId })}
              activeOpacity={0.85}
            >
              <Text style={styles.settleUpPillText}>Settle Up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expenses List Section matching Stitch */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Expenses</Text>
            <TouchableOpacity onPress={() => navigation.navigate('GroupSettings', { groupId })}>
              <Text style={styles.settingsLinkText}>Settings & Members</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 24 }} />
          ) : expenses.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialIcons name="receipt-long" size={36} color={Colors.outline} />
              <Text style={styles.emptyText}>No expenses recorded yet.</Text>
            </View>
          ) : (
            <View style={styles.expensesContainer}>
              {expenses.map((item, idx) => {
                const isPayerMe = item.paidBy === currentUid;
                const payerName = isPayerMe ? 'You' : item.paidByName || 'Member';
                const myShare = item.splitDetails?.[currentUid] || 0;

                return (
                  <TouchableOpacity
                    key={item.expenseId || idx.toString()}
                    style={[
                      styles.expenseItemRow,
                      idx !== expenses.length - 1 && styles.expenseItemBorder,
                    ]}
                    onPress={() => navigation.navigate('ExpenseDetail', { expense: item })}
                    activeOpacity={0.8}
                  >
                    <View style={styles.expenseLeft}>
                      <View style={styles.categoryCircle}>
                        <MaterialIcons
                          name={
                            item.category?.toLowerCase().includes('food')
                              ? 'restaurant'
                              : item.category?.toLowerCase().includes('hotel')
                                ? 'hotel'
                                : item.category?.toLowerCase().includes('travel') || item.category?.toLowerCase().includes('flight')
                                  ? 'flight'
                                  : 'receipt'
                          }
                          size={20}
                          color={Colors.primary}
                        />
                      </View>
                      <View style={styles.expenseDetails}>
                        <Text style={styles.expenseTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.expenseSub}>Paid by {payerName} • {formatCurrency(item.amount)}</Text>
                      </View>
                    </View>

                    <View style={styles.expenseRight}>
                      <Text style={styles.shareHeaderLabel}>Your share</Text>
                      <Text
                        style={[
                          styles.shareAmountText,
                          { color: isPayerMe ? Colors.primary : Colors.error },
                        ]}
                      >
                        {formatCurrency(myShare)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    ...Typography.headlineLgMobile,
    color: Colors.primary,
    fontWeight: '700',
    flex: 1,
    marginLeft: 8,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: Colors.primaryFixed,
  },
  topAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  topAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAvatarText: {
    ...Typography.titleSm,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  summaryLabel: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1,
    fontWeight: '600',
  },
  summaryTotalAmount: {
    ...Typography.numericDisplay,
    fontSize: 32,
    lineHeight: 40,
    color: Colors.onBackground,
    fontWeight: '700',
  },
  summarySubtext: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  addBtnCircle: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  settleUpPillBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
  },
  settleUpPillText: {
    ...Typography.titleMd,
    color: Colors.primary,
    fontWeight: '600',
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.titleMd,
    color: Colors.onBackground,
    fontWeight: '700',
  },
  settingsLinkText: {
    ...Typography.labelMd,
    color: Colors.primary,
    fontWeight: '600',
  },
  expensesContainer: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    ...Shadows.card,
    overflow: 'hidden',
  },
  expenseItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  expenseItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  categoryCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    ...Typography.titleMd,
    color: Colors.onBackground,
    fontWeight: '600',
  },
  expenseSub: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  shareHeaderLabel: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  shareAmountText: {
    ...Typography.titleMd,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyCard: {
    padding: Spacing.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
});
