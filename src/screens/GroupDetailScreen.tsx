import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { SmartImage } from '../components/SmartImage';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  formatFirestoreDate,
  formatFirestoreDateTime,
  getCurrentBillingMonth,
  getExpenseBillingMonth,
  formatBillingMonthLabel,
} from '../utils/dateUtils';
import {
  subscribeToGroupExpenses,
  subscribeToGroupSettlements,
  subscribeToGroupDetail,
  subscribeToAcceptedMembers,
  ExpenseData,
  SettlementData,
  GroupData,
  UserProfile,
} from '../services/firestoreService';
import { simplifyDebts } from '../services/debtSimplifier';
import { EmptyStateIllustration } from '../components/EmptyIllustration';
import { BannerAdSlot } from '../components/BannerAdSlot';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetail'>;

export default function GroupDetailScreen({ navigation, route }: Props) {
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || 'user_current';
  const { colors, isDark } = useTheme();

  const groupId = route.params?.groupId || 'goa_trip';

  const [group, setGroup] = useState<GroupData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [settlements, setSettlements] = useState<SettlementData[]>([]);
  const [activeMembers, setActiveMembers] = useState<UserProfile[]>([]);
  const [pendingMembers, setPendingMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentBillingMonth());
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [memberModalVisible, setMemberModalVisible] = useState(false);

  const groupOwnerRef = useRef<string | null>(null);
  const hasDefaultedMonthRef = useRef(false);

  // Map for easy profile lookups
  const memberProfilesMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    activeMembers.forEach((u) => map.set(u.uid, u));
    pendingMembers.forEach((u) => map.set(u.uid, u));
    return map;
  }, [activeMembers, pendingMembers]);

  // Real-time subscriptions
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

    const unsubSettlements = subscribeToGroupSettlements(groupId, (setList) => {
      setSettlements(setList);
    });

    return () => {
      unsubGroup();
      unsubMembers();
      unsubExpenses();
      unsubSettlements();
    };
  }, [groupId, currentUid]);

  // Default month selection: 'ALL' for Trip groups, current month for others
  useEffect(() => {
    if (group && !hasDefaultedMonthRef.current) {
      hasDefaultedMonthRef.current = true;
      if (group.groupType === 'Trip') {
        setSelectedMonth('ALL');
      } else {
        setSelectedMonth(getCurrentBillingMonth());
      }
    }
  }, [group?.groupType]);

  const groupName = group?.name || 'Group Details';
  const memberCount = activeMembers.length;

  // Sorted members for avatar display (current user first)
  const sortedMembers = useMemo(() => {
    return [...activeMembers].sort((a, b) => {
      if (a.uid === currentUid) return -1;
      if (b.uid === currentUid) return 1;
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [activeMembers, currentUid]);

  // Calculate available billing months descending with 'ALL' prepended
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(getCurrentBillingMonth());
    expenses.forEach((e) => {
      set.add(getExpenseBillingMonth(e));
    });
    settlements.forEach((s) => {
      set.add(s.billingMonth || getExpenseBillingMonth(s));
    });
    const sorted = Array.from(set).sort((a, b) => b.localeCompare(a));
    return ['ALL', ...sorted];
  }, [expenses, settlements]);

  // Filtered expenses & settlements based on selectedMonth
  const filteredExpenses = useMemo(() => {
    if (selectedMonth === 'ALL') return expenses;
    return expenses.filter((e) => getExpenseBillingMonth(e) === selectedMonth);
  }, [expenses, selectedMonth]);

  const filteredSettlements = useMemo(() => {
    if (selectedMonth === 'ALL') return settlements;
    return settlements.filter(
      (s) => (s.billingMonth || getExpenseBillingMonth(s)) === selectedMonth
    );
  }, [settlements, selectedMonth]);

  // Profiles mapping for debt simplifier
  const memberProfilesForDebts = useMemo(() => {
    const map: Record<string, { name: string; paymentHandle?: string; photoUrl?: string }> = {};
    activeMembers.forEach((u) => {
      map[u.uid] = {
        name: u.uid === currentUid ? 'You' : u.name,
        paymentHandle: u.paymentHandle || '',
        photoUrl: u.photoUrl || '',
      };
    });
    return map;
  }, [activeMembers, currentUid]);

  // Run simplifyDebts on the filtered datasets so each month has independent settlement plans
  const simplifiedDebts = useMemo(() => {
    const raw = simplifyDebts(
      filteredExpenses,
      filteredSettlements,
      memberProfilesForDebts,
      group?.memberExistingExpensesPreference
    );
    const activeMemberIds = group?.memberIds || [];
    if (activeMemberIds.length === 0) return [];
    return raw.filter(
      (d) => activeMemberIds.includes(d.fromUserId) && activeMemberIds.includes(d.toUserId)
    );
  }, [
    filteredExpenses,
    filteredSettlements,
    memberProfilesForDebts,
    group?.memberIds,
    group?.memberExistingExpensesPreference,
  ]);

  // Metrics for selected period
  const periodTotalSpent = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [filteredExpenses]);

  const periodNetBalance = useMemo(() => {
    const userTotalPaid = filteredExpenses
      .filter((e) => e.paidBy === currentUid)
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    const userTotalShare = filteredExpenses.reduce((acc, e) => {
      const splits = e.splitDetails || {};
      if (splits[currentUid] !== undefined) return acc + splits[currentUid];
      const count = Object.keys(splits).length || activeMembers.length || 1;
      return acc + (e.amount || 0) / count;
    }, 0);

    const userReceived = filteredSettlements
      .filter((s) => s.toUserId === currentUid && (s.status === 'completed' || !s.status))
      .reduce((acc, s) => acc + (s.amount || 0), 0);

    const userSent = filteredSettlements
      .filter((s) => s.fromUserId === currentUid && (s.status === 'completed' || !s.status))
      .reduce((acc, s) => acc + (s.amount || 0), 0);

    return Math.round((userTotalPaid - userTotalShare + userSent - userReceived) * 100) / 100;
  }, [filteredExpenses, filteredSettlements, currentUid, activeMembers.length]);

  // Category mini-breakdown progress bar for top 3 categories
  // Precompute spend and count per member in selected period
  const memberSpendMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const payer = e.paidBy || '';
      map[payer] = (map[payer] || 0) + (e.amount || 0);
    });
    return map;
  }, [filteredExpenses]);

  const memberExpenseCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      const payer = e.paidBy || '';
      map[payer] = (map[payer] || 0) + 1;
    });
    return map;
  }, [filteredExpenses]);

  // Filtered expenses according to selected member filter
  const displayedExpenses = useMemo(() => {
    if (!selectedMemberId || selectedMemberId === 'all') {
      return filteredExpenses;
    }
    return filteredExpenses.filter((e) => e.paidBy === selectedMemberId);
  }, [filteredExpenses, selectedMemberId]);

  // Total spent shown on card (group total or individual member's total)
  const displayedTotalSpent = useMemo(() => {
    if (!selectedMemberId || selectedMemberId === 'all') {
      return periodTotalSpent;
    }
    return displayedExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [selectedMemberId, periodTotalSpent, displayedExpenses]);

  // Label for top filter pill (e.g. "All Members", "You", "Sourya")
  const selectedMemberDisplayLabel = useMemo(() => {
    if (!selectedMemberId || selectedMemberId === 'all') {
      return 'All Members';
    }
    if (selectedMemberId === currentUid) {
      return 'You';
    }
    const prof = memberProfilesMap.get(selectedMemberId);
    const name = prof?.name?.trim() || 'Member';
    return name.split(' ')[0] || name;
  }, [selectedMemberId, currentUid, memberProfilesMap]);

  // Dynamic card title based on selected member and month
  const summaryCardTitle = useMemo(() => {
    const monthPrefix = selectedMonth === 'ALL' ? '' : `${formatBillingMonthLabel(selectedMonth).toUpperCase()} `;
    if (!selectedMemberId || selectedMemberId === 'all') {
      return selectedMonth === 'ALL'
        ? 'TOTAL GROUP SPEND'
        : `${formatBillingMonthLabel(selectedMonth).toUpperCase()} SPEND`;
    }
    if (selectedMemberId === currentUid) {
      return selectedMonth === 'ALL' ? 'YOUR TOTAL SPEND' : `YOUR ${monthPrefix}SPEND`;
    }
    const memberName = (memberProfilesMap.get(selectedMemberId)?.name || 'MEMBER').toUpperCase();
    return selectedMonth === 'ALL' ? `${memberName}'S TOTAL SPEND` : `${memberName}'S ${monthPrefix}SPEND`;
  }, [selectedMemberId, selectedMonth, currentUid, memberProfilesMap]);

  // Calculate net position for selected member if not current user
  const targetMemberNetBalance = useMemo(() => {
    if (!selectedMemberId || selectedMemberId === 'all' || selectedMemberId === currentUid) {
      return periodNetBalance;
    }

    const memberTotalPaid = filteredExpenses
      .filter((e) => e.paidBy === selectedMemberId)
      .reduce((acc, e) => acc + (e.amount || 0), 0);

    const memberTotalShare = filteredExpenses.reduce((acc, e) => {
      const splits = e.splitDetails || {};
      if (splits[selectedMemberId] !== undefined) return acc + splits[selectedMemberId];
      const count = Object.keys(splits).length || activeMembers.length || 1;
      return acc + (e.amount || 0) / count;
    }, 0);

    const memberReceived = filteredSettlements
      .filter((s) => s.toUserId === selectedMemberId && (s.status === 'completed' || !s.status))
      .reduce((acc, s) => acc + (s.amount || 0), 0);

    const memberSent = filteredSettlements
      .filter((s) => s.fromUserId === selectedMemberId && (s.status === 'completed' || !s.status))
      .reduce((acc, s) => acc + (s.amount || 0), 0);

    return Math.round((memberTotalPaid - memberTotalShare + memberSent - memberReceived) * 100) / 100;
  }, [selectedMemberId, currentUid, periodNetBalance, filteredExpenses, filteredSettlements, activeMembers.length]);

  const activeNetBalance = useMemo(() => {
    if (!selectedMemberId || selectedMemberId === 'all' || selectedMemberId === currentUid) {
      return periodNetBalance;
    }
    return targetMemberNetBalance;
  }, [selectedMemberId, currentUid, periodNetBalance, targetMemberNetBalance]);

  const activeNetText = useMemo(() => {
    if (!selectedMemberId || selectedMemberId === 'all' || selectedMemberId === currentUid) {
      if (periodNetBalance > 0.05) {
        return `You are owed ${formatCurrency(periodNetBalance)}`;
      }
      if (periodNetBalance < -0.05) {
        return `You owe ${formatCurrency(Math.abs(periodNetBalance))}`;
      }
      return selectedMonth === 'ALL'
        ? '✓ All settled up overall'
        : `✓ Settled for ${formatBillingMonthLabel(selectedMonth)}`;
    }
    const memberName = memberProfilesMap.get(selectedMemberId)?.name || 'Member';
    if (targetMemberNetBalance > 0.05) {
      return `${memberName} is owed ${formatCurrency(targetMemberNetBalance)}`;
    }
    if (targetMemberNetBalance < -0.05) {
      return `${memberName} owes ${formatCurrency(Math.abs(targetMemberNetBalance))}`;
    }
    return selectedMonth === 'ALL'
      ? `✓ ${memberName} is settled up`
      : `✓ Settled for ${formatBillingMonthLabel(selectedMonth)}`;
  }, [selectedMemberId, currentUid, periodNetBalance, targetMemberNetBalance, selectedMonth, memberProfilesMap]);

  // Category mini-breakdown progress bar for top 3 categories
  const categoryBreakdown = useMemo(() => {
    const targetExpenses = (!selectedMemberId || selectedMemberId === 'all')
      ? filteredExpenses
      : displayedExpenses;
    const catMap: Record<string, number> = {};
    targetExpenses.forEach((e) => {
      const cat = e.category || '📦 Other';
      catMap[cat] = (catMap[cat] || 0) + (e.amount || 0);
    });
    const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const top3 = sorted.slice(0, 3);
    const total = displayedTotalSpent || 1;
    return top3.map(([category, amount]) => ({
      category,
      amount,
      percent: Math.min(100, Math.round((amount / total) * 100)),
    }));
  }, [selectedMemberId, filteredExpenses, displayedExpenses, displayedTotalSpent]);

  // Section title for expenses feed
  const sectionTitle = useMemo(() => {
    const monthLabel = selectedMonth === 'ALL' ? 'All' : formatBillingMonthLabel(selectedMonth);
    if (!selectedMemberId || selectedMemberId === 'all') {
      return selectedMonth === 'ALL' ? 'All Expenses' : `${monthLabel} Expenses`;
    }
    const isMe = selectedMemberId === currentUid;
    const name = isMe ? 'You' : memberProfilesMap.get(selectedMemberId)?.name || 'Member';
    return selectedMonth === 'ALL'
      ? `Expenses Paid by ${name}`
      : `${monthLabel} Expenses (Paid by ${name})`;
  }, [selectedMonth, selectedMemberId, currentUid, memberProfilesMap]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar
        backgroundColor={colors.background}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />

      {/* Top App Bar with Decluttered Member Avatar Stack */}
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
              size={38}
              fallbackIcon={
                group?.groupType === 'Trip'
                  ? 'flight'
                  : group?.groupType === 'Family'
                  ? 'home'
                  : group?.groupType === 'Couple'
                  ? 'favorite'
                  : group?.groupType === 'Flatmate'
                  ? 'apartment'
                  : 'groups'
              }
              style={styles.avatarImage}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.topTitle, { color: colors.onBackground }]} numberOfLines={1}>
                {groupName}
              </Text>
              <Text style={[styles.topSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                {memberCount} member{memberCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Right Actions: Header Overlapping Avatar Stack + Settings */}
        <View style={styles.topRightActions}>
          {sortedMembers.length > 0 && (
            <TouchableOpacity
              style={styles.avatarStackBtn}
              onPress={() => navigation.navigate('GroupSettings', { groupId })}
              activeOpacity={0.75}
            >
              <View style={styles.avatarStack}>
                {sortedMembers.slice(0, 4).map((m, idx) => (
                  <View
                    key={m.uid}
                    style={[
                      styles.avatarCircle,
                      {
                        marginLeft: idx === 0 ? 0 : -9,
                        zIndex: 10 - idx,
                        borderColor: colors.background,
                      },
                    ]}
                  >
                    <SmartImage
                      uri={m.photoUrl}
                      thumbnailUri={m.photoThumbnailUrl}
                      name={m.name}
                      mode="thumbnail"
                      size={26}
                      fallbackIcon="person"
                    />
                  </View>
                ))}
                {sortedMembers.length > 4 && (
                  <View
                    style={[
                      styles.avatarMoreCircle,
                      {
                        marginLeft: -9,
                        zIndex: 5,
                        backgroundColor: colors.primaryContainer,
                        borderColor: colors.background,
                      },
                    ]}
                  >
                    <Text style={[styles.avatarMoreText, { color: colors.primary }]}>
                      +{sortedMembers.length - 4}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.navigate('GroupSettings', { groupId })}
            activeOpacity={0.7}
          >
            <MaterialIcons name="settings" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal Month Filter Pill Bar with Member Dropdown on Right */}
      <View style={[styles.filterBarContainer, { backgroundColor: colors.background }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthFilterContent}
          style={{ flex: 1 }}
        >
          {availableMonths.map((m) => {
            const isSelected = selectedMonth === m;
            const label = formatBillingMonthLabel(m);
            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.monthPill,
                  isSelected
                    ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
                    : {
                        backgroundColor: isDark ? colors.surfaceContainer : '#E0F2FE',
                        borderColor: isDark ? colors.outlineVariant : '#BAE6FD',
                      },
                ]}
                onPress={() => setSelectedMonth(m)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.monthPillText,
                    isSelected
                      ? { color: '#FFFFFF', fontWeight: '700' }
                      : { color: isDark ? colors.onSurface : '#0369A1', fontWeight: '600' },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Member Filter Divider & Pill */}
        <View
          style={[
            styles.memberFilterDivider,
            { backgroundColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.1)' },
          ]}
        />

        <TouchableOpacity
          style={[
            styles.memberFilterPill,
            selectedMemberId !== 'all'
              ? { backgroundColor: '#0284C7', borderColor: '#0284C7' }
              : {
                  backgroundColor: isDark ? colors.surfaceContainer : '#E0F2FE',
                  borderColor: isDark ? colors.outlineVariant : '#BAE6FD',
                },
          ]}
          onPress={() => setMemberModalVisible(true)}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={selectedMemberId !== 'all' ? 'person' : 'people-outline'}
            size={14}
            color={selectedMemberId !== 'all' ? '#FFFFFF' : (isDark ? colors.onSurface : '#0369A1')}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.memberFilterPillText,
              selectedMemberId !== 'all'
                ? { color: '#FFFFFF', fontWeight: '700' }
                : { color: isDark ? colors.onSurface : '#0369A1', fontWeight: '600' },
            ]}
            numberOfLines={1}
          >
            {selectedMemberDisplayLabel} ▾
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Simplified Context-Aware Summary Card */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
              borderWidth: 1,
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.summaryTopRow}>
            <Text style={[styles.summaryLabel, { color: colors.onSurfaceVariant }]}>
              {summaryCardTitle}
            </Text>
            {selectedMonth !== 'ALL' && (
              <View style={[styles.periodTag, { backgroundColor: colors.primaryContainer }]}>
                <Ionicons name="calendar-outline" size={11} color={colors.primary} />
                <Text style={[styles.periodTagText, { color: colors.primary }]}>
                  {formatBillingMonthLabel(selectedMonth)}
                </Text>
              </View>
            )}
          </View>

          {/* Spend Amount */}
          <Text style={[styles.summaryTotalAmount, { color: colors.onBackground }]}>
            {formatCurrency(displayedTotalSpent)}
          </Text>

          {/* User's Net Position for the Period */}
          <View
            style={[
              styles.netPositionPill,
              {
                backgroundColor:
                  activeNetBalance > 0.05
                    ? colors.positiveContainer
                    : activeNetBalance < -0.05
                    ? colors.errorContainer
                    : colors.positiveContainer,
              },
            ]}
          >
            <Ionicons
              name={
                activeNetBalance > 0.05
                  ? 'arrow-down-circle'
                  : activeNetBalance < -0.05
                  ? 'arrow-up-circle'
                  : 'checkmark-circle'
              }
              size={15}
              color={
                activeNetBalance > 0.05
                  ? colors.positiveText
                  : activeNetBalance < -0.05
                  ? colors.onErrorContainer
                  : colors.positiveText
              }
            />
            <Text
              style={[
                styles.netPositionText,
                {
                  color:
                    activeNetBalance > 0.05
                      ? colors.positiveText
                      : activeNetBalance < -0.05
                      ? colors.onErrorContainer
                      : colors.positiveText,
                },
              ]}
            >
              {activeNetText}
            </Text>
          </View>

          {/* Category Mini-Breakdown Progress Bar (Top 3) */}
          {categoryBreakdown.length > 0 && (
            <View style={styles.categoryBreakdownContainer}>
              <View
                style={[
                  styles.categoryProgressBar,
                  { backgroundColor: colors.surfaceContainerHigh },
                ]}
              >
                {categoryBreakdown.map((cat, idx) => {
                  const segColors = ['#0284C7', '#0D9488', '#F59E0B'];
                  return (
                    <View
                      key={cat.category}
                      style={{
                        width: `${cat.percent}%`,
                        height: '100%',
                        backgroundColor: segColors[idx % segColors.length],
                      }}
                    />
                  );
                })}
              </View>
              <View style={styles.categoryLegendRow}>
                {categoryBreakdown.map((cat, idx) => {
                  const segColors = ['#0284C7', '#0D9488', '#F59E0B'];
                  return (
                    <View key={cat.category} style={styles.categoryLegendItem}>
                      <View
                        style={[
                          styles.categoryLegendDot,
                          { backgroundColor: segColors[idx % segColors.length] },
                        ]}
                      />
                      <Text
                        style={[styles.categoryLegendText, { color: colors.onSurfaceVariant }]}
                        numberOfLines={1}
                      >
                        {cat.category.split(' ')[1] || cat.category} {cat.percent}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.addBtnCircle, { backgroundColor: colors.primary }]}
              onPress={() =>
                navigation.navigate('AddExpense', {
                  groupId,
                  groupName,
                  initialBillingMonth: selectedMonth === 'ALL' ? undefined : selectedMonth,
                })
              }
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={28} color={colors.onPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.settleUpPillBtn,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() =>
                navigation.navigate('SettleUp', {
                  groupId,
                  billingMonth: selectedMonth === 'ALL' ? undefined : selectedMonth,
                })
              }
              activeOpacity={0.8}
            >
              <Ionicons
                name="card-outline"
                size={18}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.settleUpPillText, { color: colors.primary }]}>
                {selectedMonth === 'ALL'
                  ? 'Settle Up'
                  : `Settle ${formatBillingMonthLabel(selectedMonth)}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expenses Feed Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>
              {sectionTitle}
            </Text>
            <Text style={[styles.sectionCount, { color: colors.onSurfaceVariant }]}>
              {displayedExpenses.length} item{displayedExpenses.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
                Loading expenses...
              </Text>
            </View>
          ) : displayedExpenses.length === 0 ? (
            <EmptyStateIllustration
              type="transactions"
              title={
                selectedMemberId && selectedMemberId !== 'all'
                  ? `No Expenses by ${
                      selectedMemberId === currentUid
                        ? 'You'
                        : memberProfilesMap.get(selectedMemberId)?.name || 'Member'
                    }`
                  : selectedMonth === 'ALL'
                  ? 'No Expenses Added Yet'
                  : `No Expenses for ${formatBillingMonthLabel(selectedMonth)}`
              }
              description={
                selectedMemberId && selectedMemberId !== 'all'
                  ? `No recorded expenses paid by ${
                      selectedMemberId === currentUid
                        ? 'you'
                        : memberProfilesMap.get(selectedMemberId)?.name || 'this member'
                    } in ${
                      selectedMonth === 'ALL'
                        ? 'this group'
                        : formatBillingMonthLabel(selectedMonth)
                    }.`
                  : selectedMonth === 'ALL'
                  ? 'Start sharing by adding the first bill, grocery, or trip expense.'
                  : `No expenses have been recorded for ${formatBillingMonthLabel(selectedMonth)}.`
              }
              actionLabel={
                selectedMemberId && selectedMemberId !== 'all'
                  ? 'View All Members'
                  : 'Add Expense'
              }
              onActionPress={() => {
                if (selectedMemberId && selectedMemberId !== 'all') {
                  setSelectedMemberId('all');
                } else {
                  navigation.navigate('AddExpense', {
                    groupId,
                    groupName,
                    initialBillingMonth: selectedMonth === 'ALL' ? undefined : selectedMonth,
                  });
                }
              }}
            />
          ) : (
            <View style={styles.expensesListWrapper}>
              {displayedExpenses.map((item, index) => {
                const isPaidByMe = item.paidBy === currentUid;
                const payerProfile = memberProfilesMap.get(item.paidBy);
                const payerName = isPaidByMe ? 'You' : payerProfile?.name || 'Member';
                const dateTimeStr = formatFirestoreDateTime(item.createdAt, item.date);

                return (
                  <TouchableOpacity
                    key={item.expenseId || index.toString()}
                    style={[
                      styles.expenseCard,
                      {
                        backgroundColor: colors.surfaceContainerLowest,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    onPress={() => navigation.navigate('ExpenseDetail', { expense: item })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.expenseLeft}>
                      <View
                        style={[
                          styles.categoryCircle,
                          {
                            backgroundColor: isPaidByMe
                              ? (isDark ? 'rgba(34, 197, 94, 0.12)' : '#DCFCE7')
                              : (isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2'),
                          },
                        ]}
                      >
                        <MaterialIcons
                          name={getCategoryIcon(item.category)}
                          size={20}
                          color={isPaidByMe ? colors.positiveText : colors.error}
                        />
                      </View>
                      <View style={styles.expenseDetails}>
                        <Text
                          style={[styles.expenseTitle, { color: colors.onBackground }]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <Text
                          style={[styles.expenseSub, { color: colors.onSurfaceVariant }]}
                          numberOfLines={1}
                        >
                          {dateTimeStr}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.expenseRight}>
                      <View
                        style={[
                          styles.amountBadge,
                          {
                            backgroundColor: isPaidByMe
                              ? (isDark ? 'rgba(34, 197, 94, 0.14)' : '#ECFDF5')
                              : (isDark ? 'rgba(239, 68, 68, 0.14)' : '#FEF2F2'),
                            borderColor: isPaidByMe
                              ? (isDark ? 'rgba(74, 222, 128, 0.3)' : '#BBF7D0')
                              : (isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA'),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.shareAmountText,
                            {
                              color: isPaidByMe ? colors.positiveText : colors.error,
                            },
                          ]}
                        >
                          {formatCurrency(item.amount)}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.shareHeaderLabel,
                          {
                            color: colors.onSurfaceVariant,
                            marginTop: 3,
                          },
                        ]}
                      >
                        {isPaidByMe ? 'You paid' : `${payerName.split(' ')[0]} paid`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Compact Pending Invitations Banner (if any) */}
        {pendingMembers.length > 0 && (
          <TouchableOpacity
            style={[
              styles.pendingBanner,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
                borderWidth: 1,
              },
            ]}
            onPress={() => navigation.navigate('GroupSettings', { groupId })}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <MaterialIcons name="mail-outline" size={20} color={colors.primary} />
              <Text style={[styles.pendingBannerText, { color: colors.onSurfaceVariant }]}>
                {pendingMembers.length} pending invitation{pendingMembers.length > 1 ? 's' : ''}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}

        <BannerAdSlot />
      </ScrollView>

      {/* Member Filter Bottom Sheet Modal */}
      <Modal
        visible={memberModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMemberModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setMemberModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.memberModalContainer,
              {
                backgroundColor: colors.surfaceContainerLowest,
                borderColor: colors.outlineVariant,
              },
            ]}
          >
            {/* Modal Drag Handle */}
            <View
              style={[
                styles.modalHandle,
                { backgroundColor: colors.outlineVariant },
              ]}
            />

            {/* Header */}
            <View
              style={[
                styles.modalHeader,
                { borderBottomColor: colors.outlineVariant },
              ]}
            >
              <View>
                <Text style={[styles.modalTitle, { color: colors.onBackground }]}>
                  Filter by Member
                </Text>
                <Text style={[styles.modalSub, { color: colors.onSurfaceVariant }]}>
                  {selectedMonth === 'ALL'
                    ? 'All-time spending by member'
                    : `${formatBillingMonthLabel(selectedMonth)} spending by member`}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setMemberModalVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            {/* Member Options List */}
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {/* Option 1: All Members */}
              <TouchableOpacity
                style={[
                  styles.memberOptionRow,
                  { borderBottomColor: colors.outlineVariant },
                  selectedMemberId === 'all' && {
                    backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#F0F9FF',
                  },
                ]}
                onPress={() => {
                  setSelectedMemberId('all');
                  setMemberModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.memberOptionLeft}>
                  <View
                    style={[
                      styles.memberOptionAvatar,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceContainerHigh
                          : '#E0F2FE',
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="groups"
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.memberOptionName,
                        {
                          color:
                            selectedMemberId === 'all'
                              ? colors.primary
                              : colors.onBackground,
                          fontWeight: selectedMemberId === 'all' ? '700' : '600',
                        },
                      ]}
                    >
                      All Members
                    </Text>
                    <Text style={[styles.memberOptionSub, { color: colors.onSurfaceVariant }]}>
                      Total group spend • {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.memberOptionRight}>
                  <Text
                    style={[
                      styles.memberOptionAmount,
                      {
                        color:
                          selectedMemberId === 'all'
                            ? colors.primary
                            : colors.onBackground,
                      },
                    ]}
                  >
                    {formatCurrency(periodTotalSpent)}
                  </Text>
                  {selectedMemberId === 'all' && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </View>
              </TouchableOpacity>

              {/* Dynamic Members from sortedMembers */}
              {sortedMembers.map((m) => {
                const isSelected = selectedMemberId === m.uid;
                const isMe = m.uid === currentUid;
                const memberName = isMe
                  ? m.name
                    ? `${m.name} (You)`
                    : 'You'
                  : m.name || 'Member';
                const memberTotalPaid = memberSpendMap[m.uid] || 0;
                const memberCount = memberExpenseCountMap[m.uid] || 0;

                return (
                  <TouchableOpacity
                    key={m.uid}
                    style={[
                      styles.memberOptionRow,
                      { borderBottomColor: colors.outlineVariant },
                      isSelected && {
                        backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#F0F9FF',
                      },
                    ]}
                    onPress={() => {
                      setSelectedMemberId(m.uid);
                      setMemberModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.memberOptionLeft}>
                      <View style={styles.memberOptionAvatar}>
                        <SmartImage
                          uri={m.photoUrl}
                          thumbnailUri={m.photoThumbnailUrl}
                          name={m.name}
                          mode="thumbnail"
                          size={40}
                          fallbackIcon="person"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.memberOptionName,
                            {
                              color: isSelected
                                ? colors.primary
                                : colors.onBackground,
                              fontWeight: isSelected ? '700' : '600',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {memberName}
                        </Text>
                        <Text
                          style={[styles.memberOptionSub, { color: colors.onSurfaceVariant }]}
                          numberOfLines={1}
                        >
                          {memberCount} expense{memberCount !== 1 ? 's' : ''} paid
                        </Text>
                      </View>
                    </View>

                    <View style={styles.memberOptionRight}>
                      <Text
                        style={[
                          styles.memberOptionAmount,
                          {
                            color: isSelected
                              ? colors.primary
                              : colors.onBackground,
                          },
                        ]}
                      >
                        {formatCurrency(memberTotalPaid)}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
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
    gap: 10,
  },
  topTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  topSub: {
    ...Typography.bodySm,
    fontSize: 12,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  avatarStackBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.full,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatarMoreCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMoreText: {
    ...Typography.bodySm,
    fontSize: 10,
    fontWeight: '700',
  },
  monthFilterContainer: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  monthFilterContent: {
    paddingHorizontal: Spacing.containerMargin,
    gap: 8,
  },
  monthPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  monthPillText: {
    ...Typography.bodySm,
    fontSize: 13,
  },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 40,
  },
  summaryCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    ...Typography.labelMd,
    letterSpacing: 1,
    fontWeight: '600',
  },
  periodTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  periodTagText: {
    ...Typography.labelMd,
    fontSize: 11,
    fontWeight: '700',
  },
  summaryTotalAmount: {
    ...Typography.numericDisplay,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
  },
  netPositionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
  },
  netPositionText: {
    ...Typography.titleSm,
    fontWeight: '700',
    fontSize: 13,
  },
  categoryBreakdownContainer: {
    marginTop: Spacing.xs,
    gap: 6,
  },
  categoryProgressBar: {
    height: 6,
    borderRadius: 3,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  categoryLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryLegendText: {
    ...Typography.bodySm,
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  addBtnCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  settleUpPillBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleUpPillText: {
    ...Typography.titleMd,
    fontSize: 15,
    fontWeight: '700',
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
  sectionCount: {
    ...Typography.bodySm,
  },
  expensesListWrapper: {
    gap: Spacing.sm,
  },
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Shadows.card,
  },
  expenseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  categoryCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseDetails: {
    flex: 1,
    marginRight: Spacing.xs,
  },
  expenseTitle: {
    ...Typography.titleMd,
    fontWeight: '600',
    fontSize: 15,
  },
  expenseSub: {
    ...Typography.bodySm,
    fontSize: 12,
    marginTop: 2,
  },
  expenseRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareHeaderLabel: {
    ...Typography.bodySm,
    fontSize: 11,
    fontWeight: '500',
  },
  shareAmountText: {
    ...Typography.titleSm,
    fontWeight: '700',
    fontSize: 15,
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
    width: 60,
    height: 60,
    borderRadius: 30,
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
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    ...Shadows.card,
  },
  pendingBannerText: {
    ...Typography.bodySm,
    fontWeight: '600',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  filterBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingRight: Spacing.containerMargin,
  },
  memberFilterDivider: {
    width: 1,
    height: 22,
    marginHorizontal: 8,
  },
  memberFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    maxWidth: 140,
  },
  memberFilterPillText: {
    ...Typography.bodySm,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  memberModalContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '75%',
    paddingBottom: Spacing.xl,
    borderWidth: 1,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  modalSub: {
    ...Typography.bodySm,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  memberOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberOptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberOptionName: {
    ...Typography.titleSm,
  },
  memberOptionSub: {
    ...Typography.bodySm,
    marginTop: 2,
  },
  memberOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberOptionAmount: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
});
