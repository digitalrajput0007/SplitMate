import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar as RNStatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { BannerAdSlot } from '../components/BannerAdSlot';
import { M3Dialog } from '../components/M3Dialog';
import { M3BottomSheet } from '../components/M3BottomSheet';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  getUserProfileFromFirestore,
  subscribeUserBalanceSummary,
  getSavedUserContactsFromFirestore,
  subscribeToPendingInvitations,
  acceptGroupInvitation,
  declineGroupInvitation,
  getAllUsersFromFirestore,
  subscribeUserActivityFeed,
  subscribeToUserPendingSettlements,
  subscribeUserMonthlyInsights,
  UserProfile,
  UserBalanceSummary,
  GroupInvitation,
  ActivityItem,
  SettlementData,
  MonthlyInsights,
} from '../services/firestoreService';
import { useUserGroups } from '../hooks/useUserGroups';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const currentUser = auth.currentUser;

  const { groups, groupBalances } = useUserGroups();

  const [firstName, setFirstName] = useState('');
  const [pendingInvitations, setPendingInvitations] = useState<GroupInvitation[]>([]);
  const [frequentContacts, setFrequentContacts] = useState<UserProfile[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<UserBalanceSummary>({
    totalBalance: 0,
    youAreOwed: 0,
    youOwe: 0,
  });

  const [allUsersMap, setAllUsersMap] = useState<Map<string, UserProfile>>(new Map());
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<SettlementData[]>([]);

  const [monthlyInsights, setMonthlyInsights] = useState<MonthlyInsights>({
    totalPaid: 0,
    totalReceived: 0,
    largestExpense: { title: 'None', amount: 0 },
    activeGroupsCount: 0,
  });

  const [loading, setLoading] = useState(true);

  const [showNoGroupsDialog, setShowNoGroupsDialog] = useState(false);
  const [showSelectGroupSheet, setShowSelectGroupSheet] = useState(false);

  // Resolve display name
  useEffect(() => {
    const resolveDisplayName = async () => {
      if (currentUser?.uid) {
        const profile = await getUserProfileFromFirestore(currentUser.uid);
        if (profile?.displayName) {
          setFirstName(profile.displayName.split(' ')[0]);
          return;
        }
      }
      if (currentUser?.displayName) {
        setFirstName(currentUser.displayName.split(' ')[0]);
        return;
      }
      setFirstName('Friend');
    };

    resolveDisplayName();
  }, [currentUser]);

  // Load frequent contacts
  useEffect(() => {
    if (!currentUser?.uid) return;
    getSavedUserContactsFromFirestore(currentUser.uid).then((contacts) => {
      setFrequentContacts(contacts.slice(0, 8));
    });
  }, [currentUser]);

  // Pre-fetch all user profiles for avatars
  useEffect(() => {
    getAllUsersFromFirestore().then((users) => {
      const uMap = new Map<string, UserProfile>();
      users.forEach((u) => uMap.set(u.uid, u));
      setAllUsersMap(uMap);
    });
  }, []);

  // Dashboard Subscriptions
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const unsubInvites = subscribeToPendingInvitations(currentUser.uid, (invList) => {
      setPendingInvitations(invList);
    });

    const unsubBalance = subscribeUserBalanceSummary(currentUser.uid, (summary) => {
      setBalanceSummary(summary);
    });

    const unsubActivity = subscribeUserActivityFeed(groups.map(g => g.groupId), (activities) => {
      setRecentActivities(activities.slice(0, 5));
    });

    const unsubSettlements = subscribeToUserPendingSettlements(currentUser.uid, (settlementList) => {
      setPendingSettlements(settlementList);
    });

    const unsubInsights = subscribeUserMonthlyInsights(currentUser.uid, (data) => {
      setMonthlyInsights(data);
      setLoading(false);
    });

    return () => {
      unsubInvites();
      unsubBalance();
      unsubActivity();
      unsubSettlements();
      unsubInsights();
    };
  }, [currentUser, groups.length]);

  const handleAcceptInv = async (inv: GroupInvitation) => {
    try {
      await acceptGroupInvitation(inv.invitationId || '', inv.groupId);
    } catch (e) {
      console.log('Error accepting invitation:', e);
    }
  };

  const handleDeclineInv = async (inv: GroupInvitation) => {
    try {
      await declineGroupInvitation(inv.invitationId || '', inv.groupId);
    } catch (e) {
      console.log('Error declining invitation:', e);
    }
  };

  const handleAddExpensePress = () => {
    if (groups.length === 0) {
      setShowNoGroupsDialog(true);
    } else if (groups.length === 1) {
      navigation.navigate('AddExpense', {
        groupId: groups[0].groupId,
        groupName: groups[0].name,
      });
    } else {
      setShowSelectGroupSheet(true);
    }
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning,';
    if (hour < 18) return 'Good Afternoon,';
    return 'Good Evening,';
  };

  const recentGroups = useMemo(() => {
    // Sort groups by createdAt descending (assuming it's a proxy for recent activity)
    const sorted = [...groups].sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
    return sorted.slice(0, 4);
  }, [groups]);

  const hasUnreadNotifications = pendingInvitations.length > 0 || pendingSettlements.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Greeting */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            {currentUser?.photoURL ? (
              <Image source={{ uri: currentUser.photoURL }} style={styles.profilePic} />
            ) : (
              <View style={[styles.profilePic, { backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{firstName.charAt(0)}</Text>
              </View>
            )}
            <View>
              <Text style={[styles.greetingLabel, { color: colors.onSurfaceVariant }]}>{getGreeting()}</Text>
              <Text style={[styles.userName, { color: colors.primary }]}>{firstName}</Text>
              <View style={styles.pendingStatus}>
                <View style={[styles.statusDot, { backgroundColor: pendingSettlements.length > 0 ? '#E11D48' : '#10B981' }]} />
                <Text style={[styles.pendingText, { color: colors.onSurfaceVariant }]}>
                  {pendingSettlements.length > 0
                    ? `You have ${pendingSettlements.length} pending settlements`
                    : 'All balances settled'}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}
          >
            <View style={[styles.notifIconContainer, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="notifications-outline" size={24} color={colors.onSurface} />
              {hasUnreadNotifications && <View style={styles.notifBadge} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* Unsettled Balances Banner */}
        {pendingSettlements.length > 0 && (
          <TouchableOpacity
            style={[styles.unsettledBanner, { backgroundColor: '#E0E7FF' }]}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('SettleUp')}
          >
            <View style={[styles.bannerIconCircle, { backgroundColor: colors.primary }]}>
              <MaterialIcons name="account-balance-wallet" size={20} color={colors.onPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: colors.onSurface }]}>You have {pendingSettlements.length} unsettled balances</Text>
              <Text style={[styles.bannerSub, { color: colors.onSurfaceVariant }]}>Tap to review and clear them.</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}

        {/* Total Balance Card */}
        <View style={[styles.netBalanceCard, { backgroundColor: colors.primary }]}>
          <View style={styles.netBalanceHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.netBalanceLabel, { color: colors.onPrimary, opacity: 0.8 }]}>NET BALANCE</Text>
              <MaterialIcons name="info-outline" size={14} color={colors.onPrimary} />
            </View>
            <TouchableOpacity style={styles.walletIconBtn} onPress={() => navigation.navigate('PaymentMethods')}>
              <Ionicons name="wallet-outline" size={20} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.amountDisplay}>
            <Text style={[styles.plusSign, { color: colors.onPrimary }]}>
              {balanceSummary.totalBalance >= 0 ? '+' : ''}
            </Text>
            <Text style={[styles.totalAmount, { color: colors.onPrimary }]}>
              {formatCurrency(balanceSummary.totalBalance)}
            </Text>
          </View>

          <View style={styles.balanceBreakdown}>
            <View style={[styles.breakdownBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.breakdownLabel, { color: colors.onPrimary, opacity: 0.8 }]}>You are owed</Text>
              <Text style={[styles.breakdownValue, { color: colors.onPrimary }]}>
                {formatCurrency(balanceSummary.youAreOwed)}
              </Text>
            </View>
            <View style={[styles.breakdownBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.breakdownLabel, { color: colors.onPrimary, opacity: 0.8 }]}>You owe</Text>
              <Text style={[styles.breakdownValue, { color: colors.onPrimary }]}>
                {formatCurrency(balanceSummary.youOwe)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.settleUpBtn, { backgroundColor: colors.onPrimary }]}
            onPress={() => navigation.navigate('SettleUp')}
            activeOpacity={0.9}
          >
            <Ionicons name="cash-outline" size={20} color={colors.primary} />
            <Text style={[styles.settleUpText, { color: colors.primary }]}>Settle Up</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionItem} onPress={handleAddExpensePress}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <MaterialIcons name="add" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.onSurface }]}>Add{"\n"}Expense</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('CreateGroup')}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <MaterialIcons name="group-add" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.onSurface }]}>Create{"\n"}Group</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('InviteContacts')}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <MaterialIcons name="person-add" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.onSurface }]}>Invite{"\n"}Friend</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('PaymentMethods')}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <MaterialIcons name="payment" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.onSurface }]}>Payment{"\n"}Methods</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>
                Pending Invitations ({pendingInvitations.length})
              </Text>
            </View>
            <View style={{ gap: Spacing.sm }}>
              {pendingInvitations.map((inv) => (
                <View key={inv.invitationId} style={[styles.invitationCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                  <View style={[styles.invitationIconCircle, { backgroundColor: '#92400E' }]}>
                    <MaterialIcons name="group" size={20} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.invitationTitle, { color: colors.onSurface }]}>{inv.groupName}</Text>
                    <Text style={[styles.invitationSub, { color: colors.onSurfaceVariant }]}>Invited by {inv.invitedByName}</Text>
                  </View>
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: colors.surfaceContainerLow }]}
                      onPress={() => handleDeclineInv(inv)}
                    >
                      <Ionicons name="close" size={20} color={colors.onSurface} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: '#1E3A8A' }]}
                      onPress={() => handleAcceptInv(inv)}
                    >
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Pending Settlements */}
        {pendingSettlements.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Pending Settlements</Text>
              <TouchableOpacity onPress={() => navigation.navigate('SettleUp')}>
                <Text style={[styles.viewAllLink, { color: colors.onSurfaceVariant }]}>View All</Text>
              </TouchableOpacity>
            </View>

            {pendingSettlements.slice(0, 3).map((s) => {
              const otherUid = s.fromUserId === currentUser?.uid ? s.toUserId : s.fromUserId;
              const otherUser = allUsersMap.get(otherUid);
              const isOwed = s.toUserId === currentUser?.uid;

              return (
                <View key={s.settlementId} style={[styles.settlementCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                  <View style={styles.settlementHeader}>
                    {otherUser?.photoUrl ? (
                      <Image source={{ uri: otherUser.photoUrl }} style={styles.settlementAvatar} />
                    ) : (
                      <View style={[styles.settlementAvatar, { backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontWeight: 'bold' }}>{(otherUser?.name || 'M').charAt(0)}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settlementName, { color: colors.onSurface }]}>{otherUser?.name || 'Member'}</Text>
                      <Text style={[styles.settlementContext, { color: colors.onSurfaceVariant }]}>{s.groupName || 'In Group'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.settlementAmount, { color: isOwed ? '#15803D' : '#B91C1C' }]}>
                        {formatCurrency(s.amount)}
                      </Text>
                      <Text style={[styles.settlementStatus, { color: isOwed ? '#15803D' : '#B91C1C' }]}>
                        {isOwed ? 'Owes you' : 'You owe'}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.settleNowBtn, { backgroundColor: isOwed ? colors.secondary : '#1E3A8A' }]}
                    onPress={() => navigation.navigate('SettleUp', { settlementId: s.settlementId })}
                  >
                    <Ionicons name={isOwed ? "notifications-outline" : "wallet-outline"} size={18} color="#FFFFFF" />
                    <Text style={styles.settleNowText}>{isOwed ? 'Remind' : 'Settle Now'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Monthly Insights */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Monthly Insights</Text>
            <Text style={[styles.insightMonth, { color: colors.onSurfaceVariant }]}>
              {new Date().toLocaleString('en-IN', { month: 'long' })}
            </Text>
          </View>
          <View style={styles.insightsGrid}>
            <View style={[styles.insightBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <View style={styles.insightHeader}>
                <MaterialIcons name="trending-up" size={16} color={colors.onSurfaceVariant} />
                <Text style={[styles.insightLabel, { color: colors.onSurfaceVariant }]}>Total Paid</Text>
              </View>
              <Text style={[styles.insightValue, { color: colors.onSurface }]}>
                {formatCurrency(monthlyInsights.totalPaid)}
              </Text>
            </View>

            <View style={[styles.insightBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <View style={styles.insightHeader}>
                <MaterialIcons name="trending-down" size={16} color={colors.onSurfaceVariant} />
                <Text style={[styles.insightLabel, { color: colors.onSurfaceVariant }]}>Total Received</Text>
              </View>
              <Text style={[styles.insightValue, { color: colors.onSurface }]}>
                {formatCurrency(monthlyInsights.totalReceived)}
              </Text>
            </View>

            <View style={[styles.insightBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <View style={styles.insightHeader}>
                <Ionicons name="receipt-outline" size={16} color={colors.onSurfaceVariant} />
                <Text style={[styles.insightLabel, { color: colors.onSurfaceVariant }]}>Largest Expense</Text>
              </View>
              <Text style={[styles.insightValue, { color: colors.onSurface }]} numberOfLines={1}>
                {formatCurrency(monthlyInsights.largestExpense.amount)}
              </Text>
              <Text style={[styles.insightSubValue, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                {monthlyInsights.largestExpense.title}
              </Text>
            </View>

            <View style={[styles.insightBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <View style={styles.insightHeader}>
                <Ionicons name="people-outline" size={16} color={colors.onSurfaceVariant} />
                <Text style={[styles.insightLabel, { color: colors.onSurfaceVariant }]}>Active Groups</Text>
              </View>
              <Text style={[styles.insightValue, { color: colors.onSurface }]}>
                {monthlyInsights.activeGroupsCount}
              </Text>
              <Text style={[styles.insightSubValue, { color: colors.onSurfaceVariant }]}>Joined</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ActivityTab')}>
              <Text style={[styles.viewAllLink, { color: colors.onSurfaceVariant }]}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.activityList, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider, borderWidth: 1 }]}>
            {recentActivities.length === 0 ? (
              <View style={{ padding: Spacing.md, alignItems: 'center' }}>
                <Text style={{ color: colors.outline }}>No recent activity</Text>
              </View>
            ) : (
              recentActivities.map((item) => {
                const actor = allUsersMap.get(item.actorUid);
                const actorName = item.actorUid === currentUser?.uid ? 'You' : actor?.name || 'Member';
                const isNegative = item.type === 'expense' && item.actorUid !== currentUser?.uid;

                return (
                  <View key={item.id} style={styles.activityItem}>
                    <View style={[styles.activityDot, { backgroundColor: item.type === 'expense' ? '#3B82F6' : '#10B981' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityTitle, { color: colors.onSurface }]}>
                        <Text style={{ fontWeight: 'bold' }}>{actorName}</Text> {item.type === 'expense' ? 'added' : item.type === 'settlement' ? 'recorded' : 'created'} <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
                      </Text>
                      <Text style={[styles.activitySub, { color: colors.onSurfaceVariant }]}>
                        {item.date} • {item.groupName}
                      </Text>
                    </View>
                    {item.amount > 0 && (
                      <Text style={[styles.activityAmount, { color: isNegative ? '#B91C1C' : '#15803D' }]}>
                        {isNegative ? '-' : '+'}{formatCurrency(item.amount)}
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Recent Groups */}
        {recentGroups.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Recent Groups</Text>
              <TouchableOpacity onPress={() => navigation.navigate('GroupsTab')}>
                <Text style={[styles.viewAllLink, { color: colors.onSurfaceVariant }]}>View All Groups</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsScroll}>
              {recentGroups.map((group) => {
                const myShare = groupBalances[group.groupId] || 0;
                let balanceLabel: 'owed' | 'owe' | 'settled' = 'settled';
                let badgeColor = colors.surfaceContainerLow;
                let badgeTextColor = colors.onSurfaceVariant;
                let displayAmount = '0';

                if (myShare > 0.05) {
                  balanceLabel = 'owed';
                  badgeColor = '#DCFCE7';
                  badgeTextColor = '#15803D';
                  displayAmount = `+${formatCurrency(Math.round(myShare))}`;
                } else if (myShare < -0.05) {
                  balanceLabel = 'owe';
                  badgeColor = '#FEE2E2';
                  badgeTextColor = '#B91C1C';
                  displayAmount = `-${formatCurrency(Math.round(Math.abs(myShare)))}`;
                }

                return (
                  <TouchableOpacity
                    key={group.groupId}
                    style={[styles.recentGroupCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}
                    onPress={() => navigation.navigate('GroupDetail', { groupId: group.groupId, groupName: group.name })}
                  >
                    <View style={[styles.groupIconContainer, { backgroundColor: colors.surfaceContainerLow }]}>
                      {group.photoUrl ? (
                        <Image source={{ uri: group.photoUrl }} style={styles.recentGroupImg} />
                      ) : (
                        <View style={[styles.recentGroupImg, { backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' }]}>
                          <MaterialIcons name={group.groupType === 'Trip' ? 'flight' : group.groupType === 'Home' ? 'home' : 'groups'} size={24} color={colors.primary} />
                        </View>
                      )}
                      {balanceLabel !== 'settled' && (
                        <View style={[styles.groupBadge, { backgroundColor: badgeColor }]}>
                          <Text style={{ color: badgeTextColor, fontSize: 10, fontWeight: 'bold' }}>{displayAmount}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.recentGroupName, { color: colors.onSurface }]} numberOfLines={1}>{group.name}</Text>
                    <View style={styles.groupMemberCount}>
                      <Ionicons name="people-outline" size={12} color={colors.onSurfaceVariant} />
                      <Text style={[styles.memberCountText, { color: colors.onSurfaceVariant }]}>{group.memberIds?.length || 0} members</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* AdMob Banner Slot */}
        <BannerAdSlot />
      </ScrollView>

      {/* Case 1: No Groups Dialog */}
      <M3Dialog
        visible={showNoGroupsDialog}
        title="No Groups Found"
        message="You need to create a group before adding shared expenses."
        confirmLabel="Create Group"
        onConfirm={() => {
          setShowNoGroupsDialog(false);
          navigation.navigate('CreateGroup');
        }}
        onDismiss={() => setShowNoGroupsDialog(false)}
      />

      {/* Case 3: Select Group Bottom Sheet */}
      <M3BottomSheet
        visible={showSelectGroupSheet}
        onDismiss={() => setShowSelectGroupSheet(false)}
        title="Select a Group"
      >
        <View style={styles.sheetContent}>
          {groups.map((group) => {
            const myShare = groupBalances[group.groupId] || 0;
            let balanceLabel = 'settled';
            let badgeColor = colors.surfaceContainerLow;
            let badgeTextColor = colors.onSurfaceVariant;
            let displayAmount = '0';

            if (myShare > 0.05) {
              balanceLabel = 'owed';
              badgeColor = '#DCFCE7';
              badgeTextColor = '#15803D';
              displayAmount = `+₹${Math.round(myShare).toLocaleString()}`;
            } else if (myShare < -0.05) {
              balanceLabel = 'owe';
              badgeColor = '#FEE2E2';
              badgeTextColor = '#B91C1C';
              displayAmount = `-₹${Math.round(Math.abs(myShare)).toLocaleString()}`;
            }

            return (
              <TouchableOpacity
                key={group.groupId}
                style={[styles.sheetItem, { borderColor: colors.divider }]}
                onPress={() => {
                  setShowSelectGroupSheet(false);
                  navigation.navigate('AddExpense', {
                    groupId: group.groupId,
                    groupName: group.name,
                  });
                }}
              >
                <View style={styles.sheetItemLeft}>
                  {group.photoUrl ? (
                    <Image source={{ uri: group.photoUrl }} style={styles.sheetItemImg} />
                  ) : (
                    <View style={[styles.sheetItemImg, { backgroundColor: colors.primaryFixed, alignItems: 'center', justifyContent: 'center' }]}>
                      <MaterialIcons
                        name={group.groupType === 'Trip' ? 'flight' : group.groupType === 'Home' ? 'home' : 'groups'}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                  )}
                  <View>
                    <Text style={[styles.sheetItemName, { color: colors.onSurface }]}>{group.name}</Text>
                    <Text style={[styles.sheetItemSub, { color: colors.onSurfaceVariant }]}>
                      {group.groupType} • {group.memberIds?.length || 0} members
                    </Text>
                    {group.createdAt && (
                      <Text style={[styles.sheetItemActivity, { color: colors.outline }]}>
                        Last activity: {new Date(group.createdAt.seconds * 1000).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
                {balanceLabel !== 'settled' && (
                  <View style={[styles.sheetBadge, { backgroundColor: badgeColor }]}>
                    <Text style={{ color: badgeTextColor, fontSize: 10, fontWeight: 'bold' }}>{displayAmount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.sheetAddBtn, { borderColor: colors.primary }]}
            onPress={() => {
              setShowSelectGroupSheet(false);
              navigation.navigate('CreateGroup');
            }}
          >
            <MaterialIcons name="add" size={20} color={colors.primary} />
            <Text style={[styles.sheetAddText, { color: colors.primary }]}>Create New Group</Text>
          </TouchableOpacity>
        </View>
      </M3BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 40,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  profilePic: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  greetingLabel: {
    ...Typography.bodySm,
    color: '#64748B',
  },
  userName: {
    ...Typography.headlineSm,
    fontWeight: 'bold',
  },
  pendingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pendingText: {
    ...Typography.bodySm,
    fontSize: 10,
  },
  notifBtn: {
    width: 48,
    height: 48,
  },
  notifIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E11D48',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  unsettledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
  },
  bannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    ...Typography.titleSm,
    fontWeight: 'bold',
  },
  bannerSub: {
    ...Typography.bodySm,
    fontSize: 11,
  },
  netBalanceCard: {
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    ...Shadows.cardElevated,
  },
  netBalanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netBalanceLabel: {
    ...Typography.labelMd,
    letterSpacing: 1,
  },
  walletIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  plusSign: {
    fontSize: 24,
    fontWeight: '300',
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  balanceBreakdown: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  breakdownBox: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 4,
  },
  breakdownLabel: {
    ...Typography.bodySm,
    fontSize: 10,
  },
  breakdownValue: {
    ...Typography.titleMd,
    fontWeight: 'bold',
  },
  settleUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: BorderRadius.xl,
    gap: 8,
  },
  settleUpText: {
    ...Typography.titleMd,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  actionItem: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  actionLabel: {
    ...Typography.labelMd,
    textAlign: 'center',
    lineHeight: 14,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    ...Typography.titleMd,
    fontWeight: 'bold',
  },
  viewAllLink: {
    ...Typography.labelMd,
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
  },
  invitationIconCircle: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invitationTitle: {
    ...Typography.titleSm,
    fontWeight: 'bold',
  },
  invitationSub: {
    ...Typography.bodySm,
    fontSize: 11,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settlementCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  settlementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settlementAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  settlementName: {
    ...Typography.titleSm,
    fontWeight: 'bold',
  },
  settlementContext: {
    ...Typography.bodySm,
    fontSize: 11,
  },
  settlementAmount: {
    ...Typography.titleSm,
    fontWeight: 'bold',
  },
  settlementStatus: {
    ...Typography.bodySm,
    fontSize: 10,
  },
  settleNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  settleNowText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  remindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  remindText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  insightMonth: {
    ...Typography.bodySm,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  insightBox: {
    width: '47%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  insightLabel: {
    ...Typography.bodySm,
    fontSize: 10,
  },
  insightValue: {
    ...Typography.titleMd,
    fontWeight: 'bold',
    marginTop: 4,
  },
  insightSubValue: {
    ...Typography.bodySm,
    fontSize: 10,
  },
  activityList: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    gap: Spacing.lg,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityTitle: {
    ...Typography.bodySm,
  },
  activitySub: {
    ...Typography.bodySm,
    fontSize: 10,
  },
  activityAmount: {
    ...Typography.titleSm,
    fontWeight: 'bold',
  },
  groupsScroll: {
    gap: Spacing.md,
    paddingRight: Spacing.containerMargin,
  },
  recentGroupCard: {
    width: 140,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  groupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    position: 'relative',
  },
  recentGroupImg: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
  },
  groupBadge: {
    position: 'absolute',
    top: -6,
    right: -16,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  recentGroupName: {
    ...Typography.titleSm,
    fontWeight: 'bold',
    marginTop: 4,
  },
  groupMemberCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberCountText: {
    ...Typography.bodySm,
    fontSize: 10,
  },
  sheetContent: {
    gap: Spacing.sm,
    paddingBottom: 20,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  sheetItemImg: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  sheetItemName: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
  sheetItemSub: {
    ...Typography.bodySm,
    fontSize: 11,
    marginTop: 2,
  },
  sheetItemActivity: {
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 1,
  },
  sheetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  sheetAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  sheetAddText: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
});
