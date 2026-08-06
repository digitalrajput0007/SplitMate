import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { BannerAdSlot } from '../components/BannerAdSlot';
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
  UserProfile,
  UserBalanceSummary,
  GroupInvitation,
  ActivityItem,
  SettlementData,
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

  const [monthlyInsights] = useState({
    totalSpent: 8450, // Mock for now as per design screenshot
    totalReceived: 12200,
    largestExpense: { title: 'Flight to Goa', amount: 4200 },
    settlementsThisMonth: 14,
  });

  // Resolve display name: Firestore profile → Auth displayName → email prefix → generic
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
      if (currentUser?.email) {
        const prefix = currentUser.email.split('@')[0];
        setFirstName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
        return;
      }
      setFirstName('Friend');
    };

    resolveDisplayName();
  }, [currentUser]);

  // Load frequent contacts for horizontal row
  useEffect(() => {
    if (!currentUser?.uid) return;
    getSavedUserContactsFromFirestore(currentUser.uid).then((contacts) => {
      setFrequentContacts(contacts.slice(0, 8));
    });
  }, [currentUser]);

  // Pre-fetch all user profiles in system once for fast avatar rendering in GroupCard
  useEffect(() => {
    getAllUsersFromFirestore().then((users) => {
      const uMap = new Map<string, UserProfile>();
      users.forEach((u) => uMap.set(u.uid, u));
      setAllUsersMap(uMap);
    });
  }, []);

  // Dashboard Subscriptions
  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsubInvites = subscribeToPendingInvitations(currentUser.uid, (invList) => {
      setPendingInvitations(invList);
    });

    const unsubBalance = subscribeUserBalanceSummary(currentUser.uid, (summary) => {
      setBalanceSummary(summary);
    });

    const unsubActivity = subscribeUserActivityFeed(groups.map(g => g.groupId), (activities) => {
      setRecentActivities(activities.slice(0, 5));
    });

    return () => {
      unsubInvites();
      unsubBalance();
      unsubActivity();
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

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning,';
    if (hour < 18) return 'Good Afternoon,';
    return 'Good Evening,';
  };

  const recentGroups = groups.slice(0, 4);

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
                <View style={[styles.statusDot, { backgroundColor: '#E11D48' }]} />
                <Text style={[styles.pendingText, { color: colors.onSurfaceVariant }]}>You have {pendingSettlements.length || 3} pending settlements</Text>
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
              <View style={styles.notifBadge} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Unsettled Balances Banner */}
        <TouchableOpacity
          style={[styles.unsettledBanner, { backgroundColor: '#E0E7FF' }]}
          activeOpacity={0.8}
        >
          <View style={[styles.bannerIconCircle, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="location-on" size={20} color={colors.onPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.onSurface }]}>You have 2 unsettled balances</Text>
            <Text style={[styles.bannerSub, { color: colors.onSurfaceVariant }]}>Tap to review and clear them.</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Total Balance Card Redesign */}
        <View style={[styles.netBalanceCard, { backgroundColor: colors.primary }]}>
          <View style={styles.netBalanceHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={[styles.netBalanceLabel, { color: colors.onPrimary, opacity: 0.8 }]}>NET BALANCE</Text>
              <MaterialIcons name="info-outline" size={14} color={colors.onPrimary} />
            </View>
            <TouchableOpacity style={styles.walletIconBtn}>
              <Ionicons name="wallet-outline" size={20} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.amountDisplay}>
            <Text style={[styles.plusSign, { color: colors.onPrimary }]}>+</Text>
            <Text style={[styles.totalAmount, { color: colors.onPrimary }]}>₹{balanceSummary.totalBalance.toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.balanceBreakdown}>
            <View style={[styles.breakdownBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.breakdownLabel, { color: colors.onPrimary, opacity: 0.8 }]}>You are owed</Text>
              <Text style={[styles.breakdownValue, { color: colors.onPrimary }]}>₹{balanceSummary.youAreOwed.toLocaleString('en-IN')}</Text>
            </View>
            <View style={[styles.breakdownBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.breakdownLabel, { color: colors.onPrimary, opacity: 0.8 }]}>You owe</Text>
              <Text style={[styles.breakdownValue, { color: colors.onPrimary }]}>₹{balanceSummary.youOwe.toLocaleString('en-IN')}</Text>
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
          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('AddExpense')}>
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

        {/* Pending Invitations Banner / Section */}
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
                    <MaterialIcons name="flight" size={20} color="#FFFFFF" />
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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Pending Settlements</Text>
            <TouchableOpacity onPress={() => navigation.navigate('SettleUp')}>
              <Text style={[styles.viewAllLink, { color: colors.onSurfaceVariant }]}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.settlementCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={styles.settlementHeader}>
              <View style={[styles.settlementAvatar, { backgroundColor: colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settlementName, { color: colors.onSurface }]}>Priya S.</Text>
                <Text style={[styles.settlementContext, { color: colors.onSurfaceVariant }]}>Goa Trip '24</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.settlementAmount, { color: '#B91C1C' }]}>₹1,200</Text>
                <Text style={[styles.settlementStatus, { color: '#B91C1C' }]}>You owe</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.settleNowBtn, { backgroundColor: '#1E3A8A' }]}>
              <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
              <Text style={styles.settleNowText}>Settle Now</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.settlementCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={styles.settlementHeader}>
              <View style={[styles.settlementAvatar, { backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: '#92400E', fontWeight: 'bold' }}>R</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settlementName, { color: colors.onSurface }]}>Rahul K.</Text>
                <Text style={[styles.settlementContext, { color: colors.onSurfaceVariant }]}>Dinner at Taj</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.settlementAmount, { color: '#15803D' }]}>₹4,500</Text>
                <Text style={[styles.settlementStatus, { color: '#15803D' }]}>Owes you</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.remindBtn, { borderColor: colors.outlineVariant, borderWidth: 1 }]}>
              <Ionicons name="notifications-outline" size={18} color={colors.onSurface} />
              <Text style={[styles.remindText, { color: colors.onSurface }]}>Remind</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Monthly Insights */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Monthly Insights</Text>
            <Text style={[styles.insightMonth, { color: colors.onSurfaceVariant }]}>October</Text>
          </View>
          <View style={styles.insightsGrid}>
            <View style={[styles.insightBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <View style={styles.insightHeader}>
                <MaterialIcons name="trending-up" size={16} color={colors.onSurfaceVariant} />
                <Text style={[styles.insightLabel, { color: colors.onSurfaceVariant }]}>Total Spent</Text>
              </View>
              <Text style={[styles.insightValue, { color: colors.onSurface }]}>₹8,450</Text>
            </View>

            <View style={[styles.insightBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <View style={styles.insightHeader}>
                <MaterialIcons name="trending-down" size={16} color={colors.onSurfaceVariant} />
                <Text style={[styles.insightLabel, { color: colors.onSurfaceVariant }]}>Total Received</Text>
              </View>
              <Text style={[styles.insightValue, { color: colors.onSurface }]}>₹12,200</Text>
            </View>

            <View style={[styles.insightBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <View style={styles.insightHeader}>
                <Ionicons name="receipt-outline" size={16} color={colors.onSurfaceVariant} />
                <Text style={[styles.insightLabel, { color: colors.onSurfaceVariant }]}>Largest Expense</Text>
              </View>
              <Text style={[styles.insightValue, { color: colors.onSurface }]}>₹4,200</Text>
              <Text style={[styles.insightSubValue, { color: colors.onSurfaceVariant }]}>Flight to Goa</Text>
            </View>

            <View style={[styles.insightBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <View style={styles.insightHeader}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.onSurfaceVariant} />
                <Text style={[styles.insightLabel, { color: colors.onSurfaceVariant }]}>Settlements</Text>
              </View>
              <Text style={[styles.insightValue, { color: colors.onSurface }]}>14</Text>
              <Text style={[styles.insightSubValue, { color: colors.onSurfaceVariant }]}>This month</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Activity')}>
              <Text style={[styles.viewAllLink, { color: colors.onSurfaceVariant }]}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.activityList, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider, borderWidth: 1 }]}>
            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: '#3B82F6' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.onSurface }]}>
                  <Text style={{ fontWeight: 'bold' }}>Rahul</Text> added <Text style={{ fontWeight: 'bold' }}>Dinner</Text>
                </Text>
                <Text style={[styles.activitySub, { color: colors.onSurfaceVariant }]}>2h ago • Goa Trip '24</Text>
              </View>
              <Text style={[styles.activityAmount, { color: '#B91C1C' }]}>-₹850</Text>
            </View>

            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: '#10B981' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.onSurface }]}>
                  <Text style={{ fontWeight: 'bold' }}>Neha</Text> paid you back
                </Text>
                <Text style={[styles.activitySub, { color: colors.onSurfaceVariant }]}>Yesterday • Movies</Text>
              </View>
              <Text style={[styles.activityAmount, { color: '#15803D' }]}>+₹400</Text>
            </View>

            <View style={styles.activityItem}>
              <View style={[styles.activityDot, { backgroundColor: '#6366F1' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.activityTitle, { color: colors.onSurface }]}>
                  You created <Text style={{ fontWeight: 'bold' }}>Flat 302</Text>
                </Text>
                <Text style={[styles.activitySub, { color: colors.onSurfaceVariant }]}>Oct 12</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Groups */}
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

        {/* AdMob Banner Slot */}
        <BannerAdSlot />
      </ScrollView>
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
});
