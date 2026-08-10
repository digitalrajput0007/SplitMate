import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { SmartImage } from '../components/SmartImage';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  subscribeToGroupExpenses,
  subscribeToGroupDetail,
  subscribeToAcceptedMembers,
  getUserProfileFromFirestore,
  getAllUsersFromFirestore,
  ExpenseData,
  GroupData,
  UserProfile,
} from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ navigation, route }: Props) {
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || 'user_current';
  const { colors, isDark } = useTheme();

  const groupId = route.params?.groupId || 'goa_trip';

  const [group, setGroup] = useState<GroupData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [activeMembers, setActiveMembers] = useState<UserProfile[]>([]);
  const [pendingMembers, setPendingMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const groupOwnerRef = useRef<string | null>(null);

  // Map for easy profile lookups (Reactive)
  const memberProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    activeMembers.forEach(u => map.set(u.uid, u));
    pendingMembers.forEach(u => map.set(u.uid, u));
    return map;
  }, [activeMembers, pendingMembers]);

  useEffect(() => {
    const unsubGroup = subscribeToGroupDetail(groupId, (data) => {
      if (data) {
        setGroup(data);
        if (data.createdBy) groupOwnerRef.current = data.createdBy;
      } else {
        const isOwner = groupOwnerRef.current === currentUid;
        if (isOwner) {
          navigation.navigate('MainTabs', { screen: 'GroupsTab' } as any);
        } else {
          Alert.alert(
            'Group Deleted',
            'The group owner has deleted this group.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.navigate('MainTabs', { screen: 'GroupsTab' } as any);
                },
              },
            ]
          );
        }
      }
    });

    const unsubMembers = subscribeToAcceptedMembers(groupId, (accepted, pending) => {
      setActiveMembers(accepted);
      setPendingMembers(pending);
    });

    const unsubExpenses = subscribeToGroupExpenses(groupId, (expList) => {
      setExpenses(expList);
      setLoading(false);
    });

    return () => {
      unsubGroup();
      unsubMembers();
      unsubExpenses();
    };
  }, [groupId, currentUid]);

  const groupName = group?.name || 'Group Details';
  const memberCount = activeMembers.length;
  const totalSpent = expenses.reduce((sum, item) => sum + (item.amount || 0), 0);

  const sortedMembers = useMemo(() => {
    return [...activeMembers].sort((a, b) => {
      if (a.uid === currentUid) return -1;
      if (b.uid === currentUid) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [activeMembers, currentUid]);

  const memberNamesMap = activeMembers.reduce((acc, m) => {
    acc[m.uid] = m.uid === currentUid ? 'You' : m.name;
    return acc;
  }, {} as Record<string, string>);

  let netBalance = 0;
  expenses.forEach((item) => {
    const amt = item.amount || 0;
    const paidBy = item.paidBy;
    const splits = item.splitDetails || {};
    const memberCountForSplit = Object.keys(splits).length || memberCount || 1;
    const mySplitShare = splits[currentUid] !== undefined ? splits[currentUid] : amt / memberCountForSplit;

    if (paidBy === currentUid) {
      netBalance += amt - mySplitShare;
    } else if (splits[currentUid] !== undefined) {
      netBalance -= mySplitShare;
    }
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      {/* Custom Top Navigation Bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.outlineVariant }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>

        <View style={styles.topTitleContainer}>
          <View style={styles.titleWithAvatar}>
            <SmartImage
              uri={group?.photoUrl}
              thumbnailUri={group?.photoThumbnailUrl}
              name={groupName}
              mode="full"
              size={40}
              fallbackIcon={
                group?.groupType === 'Trip' ? 'flight' :
                group?.groupType === 'Family' ? 'home' :
                group?.groupType === 'Couple' ? 'favorite' :
                group?.groupType === 'Flatmate' ? 'apartment' : 'groups'
              }
              style={styles.avatarImage}
            />
            <View>
              <Text style={[styles.topTitle, { color: colors.onBackground }]} numberOfLines={1}>
                {groupName}
              </Text>
              <Text style={[styles.topSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.topRightActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('GroupSettings', { groupId })}
            activeOpacity={0.7}
          >
            <MaterialIcons name="settings" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Total Group Spend Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
          <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>TOTAL GROUP SPENT</Text>
          <Text style={[styles.summaryTotalAmount, { color: colors.onBackground }]}>{formatCurrency(totalSpent)}</Text>
          <Text style={[styles.summarySubtext, { color: colors.onSurfaceVariant }]}>
            {netBalance === 0
              ? 'You are all settled up in this group'
              : netBalance > 0
              ? `You are owed ${formatCurrency(netBalance)} overall`
              : `You owe ${formatCurrency(Math.abs(netBalance))} overall`}
          </Text>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.addBtnCircle, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('AddExpense', { groupId, groupName: groupName })}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={28} color={colors.onPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settleUpPillBtn, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.primary }]}
              onPress={() => navigation.navigate('SettleUp', { groupId })}
              activeOpacity={0.8}
            >
              <Text style={[styles.settleUpPillText, { color: colors.primary }]}>Settle up</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expenses Feed Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Group Expenses</Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Loading expenses...</Text>
            </View>
          ) : expenses.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
              <View style={[styles.emptyIconBox, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="receipt-long" size={40} color={colors.outline} />
              </View>
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>No expenses added yet.</Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primaryFixed }]}
                onPress={() => navigation.navigate('AddExpense', { groupId, groupName })}
              >
                <Text style={[styles.emptyBtnText, { color: colors.primary }]}>Add First Expense</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.expensesContainer, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
              {expenses.map((item, index) => {
                const payerProfile = memberProfilesMap.get(item.paidBy);
                const payerName = item.paidBy === currentUid ? 'You' : (payerProfile?.name || 'Member');
                const isLast = index === expenses.length - 1;
                const dateStr = item.createdAt
                  ? new Date((item.createdAt as any).seconds * 1000).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : 'Recent';

                return (
                  <TouchableOpacity
                    key={item.expenseId || index.toString()}
                    style={[
                      styles.expenseItemRow,
                      !isLast && [styles.expenseItemBorder, { borderBottomColor: colors.outlineVariant }],
                    ]}
                    onPress={() => navigation.navigate('ExpenseDetail', { expense: item })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.expenseLeft}>
                      <View style={[styles.categoryCircle, { backgroundColor: colors.primaryFixed }]}>
                        <MaterialIcons
                          name={getCategoryIcon(item.category)}
                          size={20}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.expenseDetails}>
                        <Text style={[styles.expenseTitle, { color: colors.onBackground }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.expenseSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                          {payerName} paid {formatCurrency(item.amount)} • {dateStr}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.expenseRight}>
                      <Text style={[styles.shareHeaderLabel, { color: colors.onSurfaceVariant }]}>Total</Text>
                      <Text style={[styles.shareAmountText, { color: colors.onBackground }]}>{formatCurrency(item.amount)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Group Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Group Members ({activeMembers.length})</Text>
          </View>
          <View style={styles.membersRow}>
            {sortedMembers.map((m) => (
              <View key={m.uid} style={styles.memberItem}>
                <SmartImage
                  uri={m.photoUrl}
                  thumbnailUri={m.photoThumbnailUrl}
                  name={m.name}
                  mode="thumbnail"
                  size={48}
                  fallbackIcon="person"
                  style={styles.avatarImage}
                />
                <Text style={[styles.memberNameText, { color: colors.onSurface }]} numberOfLines={1}>
                  {m.uid === currentUid ? 'You' : m.name.split(' ')[0]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pending Invitations Section */}
        {pendingMembers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Pending Invitations ({pendingMembers.length})</Text>
            </View>
            <View style={styles.membersRow}>
              {pendingMembers.map((m) => (
                <View key={m.uid} style={[styles.memberItem, { opacity: 0.6 }]}>
                  <SmartImage
                    uri={m.photoUrl}
                    thumbnailUri={m.photoThumbnailUrl}
                    name={m.name}
                    mode="thumbnail"
                    size={48}
                    fallbackIcon="person"
                    style={styles.avatarImage}
                  />
                  <Text style={[styles.memberNameText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {m.name.split(' ')[0]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function paidByText(item: ExpenseData, currentUid: string, memberNamesMap: Record<string, string>): string {
  if (item.paidBy === currentUid) return 'You';
  return memberNamesMap[item.paidBy] || 'Someone';
}

function getCategoryIcon(cat?: string): keyof typeof MaterialIcons.glyphMap {
  if (!cat) return 'receipt';
  const c = cat.toLowerCase();
  if (c.includes('food') || c.includes('dinner') || c.includes('lunch')) return 'restaurant';
  if (c.includes('flight') || c.includes('travel') || c.includes('trip')) return 'flight';
  if (c.includes('home') || c.includes('rent') || c.includes('bill')) return 'house';
  if (c.includes('movie') || c.includes('fun')) return 'movie';
  return 'receipt';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitleContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
  },
  titleWithAvatar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  topSub: {
    ...Typography.bodyMd,
    fontSize: 12,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  summaryLabel: {
    ...Typography.labelMd,
    letterSpacing: 1,
    fontWeight: '600',
  },
  summaryTotalAmount: {
    ...Typography.numericDisplay,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
  },
  summarySubtext: {
    ...Typography.bodyMd,
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
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  settleUpPillBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleUpPillText: {
    ...Typography.titleMd,
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
    fontWeight: '700',
  },
  expensesContainer: {
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseDetails: {
    flex: 1,
  },
  expenseTitle: {
    ...Typography.titleMd,
    fontWeight: '600',
  },
  expenseSub: {
    ...Typography.bodyMd,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  shareHeaderLabel: {
    ...Typography.bodyMd,
    fontSize: 12,
  },
  shareAmountText: {
    ...Typography.titleMd,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    ...Shadows.card,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: {
    ...Typography.bodyMd,
    textAlign: 'center',
  },
  emptyBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    marginTop: 8,
  },
  emptyBtnText: {
    ...Typography.labelLg,
    fontWeight: '700',
  },
  loadingBox: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.bodyMd,
  },
  membersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  memberItem: {
    alignItems: 'center',
    width: 60,
    gap: 4,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  memberNameText: {
    ...Typography.bodySm,
    textAlign: 'center',
  },
});
