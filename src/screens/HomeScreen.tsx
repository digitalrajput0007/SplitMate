import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar as RNStatusBar,
  Platform,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { BannerAdSlot } from '../components/BannerAdSlot';
import { M3Dialog } from '../components/M3Dialog';
import { M3BottomSheet } from '../components/M3BottomSheet';
import { SmartImage } from '../components/SmartImage';
import { SmartInsight } from '../components/SmartInsight';
import { auth, db } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  acceptGroupInvitation,
  declineGroupInvitation,
  subscribeUserActivityFeed,
  subscribeUserMonthlyInsights,
  subscribeToNotifications,
  subscribeToUserProfile,
  UserProfile,
  ActivityItem,
  SettlementData,
  MonthlyInsights,
  AppNotification,
  GroupInvitation,
  markNotificationAsRead,
  addSettlementToFirestore,
  confirmSettlementInFirestore,
  rejectSettlementInFirestore,
  processDueRecurringExpenses,
} from '../services/firestoreService';
import { useUserGroups } from '../hooks/useUserGroups';
import { useHomeActions } from '../hooks/useHomeActions';
import { doc, onSnapshot } from 'firebase/firestore';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const currentUser = auth.currentUser;
  const { groups, loading: groupsLoading } = useUserGroups();
  const { actionState, invites, reminders, pendingConfirmations, balance } = useHomeActions(groups.length);

  const [firstName, setFirstName] = useState('');
  const [userPhoto, setUserPhoto] = useState(currentUser?.photoURL || '');
  const [userPhotoThumb, setUserPhotoThumb] = useState('');

  const [allUsersMap, setAllUsersMap] = useState<Map<string, UserProfile>>(new Map());
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<AppNotification[]>([]);

  const [monthlyInsights, setMonthlyInsights] = useState<MonthlyInsights>({
    totalPaid: 0,
    totalReceived: 0,
    largestExpense: { title: 'None', amount: 0 },
    activeGroupsCount: 0,
  });
  const [showNoGroupsDialog, setShowNoGroupsDialog] = useState(false);
  const [showSelectGroupSheet, setShowSelectGroupSheet] = useState(false);

  // Trigger background process for due recurring expenses idempotently
  useEffect(() => {
    if (currentUser) {
      processDueRecurringExpenses().catch((e) =>
        console.warn('[Recurring] Background process error:', e)
      );
    }
  }, [currentUser?.uid]);

  // Listen to needed user profiles for activity feed
  useEffect(() => {
    if (recentActivities.length === 0 && unreadNotifications.length === 0 && pendingConfirmations.length === 0) return;

    const uidsToFetch = new Set<string>();
    recentActivities.forEach(a => {
      if (a.actorUid) uidsToFetch.add(a.actorUid);
      if (a.targetUid) uidsToFetch.add(a.targetUid);
    });
    unreadNotifications.forEach(n => {
      if (n.senderUid) uidsToFetch.add(n.senderUid);
    });
    pendingConfirmations.forEach(s => {
      if (s.fromUserId) uidsToFetch.add(s.fromUserId);
    });

    const unsubs: (() => void)[] = [];
    uidsToFetch.forEach(uid => {
      if (!allUsersMap.has(uid)) {
        const unsub = subscribeToUserProfile(uid, (profile) => {
          if (profile) {
            setAllUsersMap(prev => {
              const next = new Map(prev);
              next.set(uid, profile);
              return next;
            });
          }
        });
        unsubs.push(unsub);
      }
    });

    return () => unsubs.forEach(u => u());
  }, [recentActivities, unreadNotifications, pendingConfirmations]);

  // Dashboard Subscriptions
  useEffect(() => {
    if (!currentUser?.uid) return;

    let unsubActivity: (() => void) | undefined;
    let unsubNotifications: (() => void) | undefined;
    let unsubInsights: (() => void) | undefined;
    let unsubProfile: (() => void) | undefined;

    const task = InteractionManager.runAfterInteractions(() => {
      unsubActivity = subscribeUserActivityFeed(groups.map(g => g.groupId), (activities) => {
        setRecentActivities(activities.slice(0, 5));
      });

      unsubNotifications = subscribeToNotifications(currentUser.uid, (notifList) => {
        setUnreadNotifications(notifList.filter(n => !n.isRead && !n.read));
      });

      unsubInsights = subscribeUserMonthlyInsights(currentUser.uid, setMonthlyInsights);

      unsubProfile = subscribeToUserProfile(currentUser.uid, (data) => {
        if (data) {
          if (data.name) setFirstName(data.name.split(' ')[0]);
          setUserPhoto(data.photoUrl || '');
          setUserPhotoThumb(data.photoThumbnailUrl || '');
        }
      });
    });

    return () => {
      task.cancel();
      if (unsubActivity) unsubActivity();
      if (unsubNotifications) unsubNotifications();
      if (unsubInsights) unsubInsights();
      if (unsubProfile) unsubProfile();
    };
  }, [currentUser?.uid, groups.length]);

  const handleActionCTA = () => {
    switch (actionState.priority) {
      case 'INVITATION':
        // Scroll to invitations or open a modal (invitations are elevated now)
        break;
      case 'REMINDER':
      case 'OWE':
      case 'CONFIRMATION':
      case 'OWED':
        navigation.navigate('SettlementCenter');
        break;
      case 'NO_GROUPS':
        navigation.navigate('CreateGroup');
        break;
      case 'SETTLED':
        handleAddExpensePress();
        break;
    }
  };

  const handleAddExpensePress = () => {
    if (groups.length === 0) {
      setShowNoGroupsDialog(true);
    } else if (groups.length === 1) {
      navigation.navigate('AddExpense', { groupId: groups[0].groupId, groupName: groups[0].name });
    } else {
      setShowSelectGroupSheet(true);
    }
  };

  const handleConfirmPayment = async (s: SettlementData) => {
    if (!s.settlementId) return;
    try {
      await confirmSettlementInFirestore(s.settlementId);
      Alert.alert('Settlement Confirmed', 'The balance has been updated.');
    } catch (e) {
      console.log('Error confirming settlement:', e);
    }
  };

  const handleDismissReminder = async (n: AppNotification) => {
    const id = n.id || n.notificationId;
    if (!id) {
      console.warn('[Home] Cannot dismiss reminder: missing ID', n);
      return;
    }
    setUnreadNotifications((prev) => prev.filter((item) => (item.id || item.notificationId) !== id));
    await markNotificationAsRead(id);
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning,';
    if (hour >= 12 && hour < 17) return 'Good Afternoon,';
    return 'Good Evening,';
  };

  const hasUnreadNotifications = unreadNotifications.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Greeting - Action Oriented */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <SmartImage
              uri={userPhoto || undefined}
              thumbnailUri={userPhotoThumb || undefined}
              name={firstName}
              size={48}
              mode="thumbnail"
              fallbackIcon="person"
              style={styles.profilePic}
            />
            <View>
              <Text style={[styles.greetingLabel, { color: colors.onSurfaceVariant }]}>{getGreeting()}</Text>
              <Text style={[styles.userName, { color: colors.primary }]}>{firstName}</Text>
              <TouchableOpacity onPress={handleActionCTA} style={styles.dynamicLine}>
                <View style={[styles.statusDot, { backgroundColor: (actionState.priority === 'OWE' || actionState.priority === 'REMINDER') ? '#E11D48' : '#10B981' }]} />
                <Text style={[styles.pendingText, { color: colors.onSurfaceVariant }]}>
                  {actionState.message}
                </Text>
                <MaterialIcons name="chevron-right" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <View style={[styles.notifIconContainer, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name="notifications-outline" size={24} color={colors.onSurface} />
              {hasUnreadNotifications && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadNotifications.length}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>

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
              {balance.totalBalance >= 0 ? '+' : ''}
            </Text>
            <Text style={[styles.totalAmount, { color: colors.onPrimary }]}>
              {formatCurrency(balance.totalBalance)}
            </Text>
          </View>

          <View style={styles.balanceBreakdown}>
            <View style={[styles.breakdownBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.breakdownLabel, { color: colors.onPrimary, opacity: 0.8 }]}>You are owed</Text>
              <Text style={[styles.breakdownValue, { color: colors.onPrimary }]}>
                {formatCurrency(balance.youAreOwed)}
              </Text>
            </View>
            <View style={[styles.breakdownBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Text style={[styles.breakdownLabel, { color: colors.onPrimary, opacity: 0.8 }]}>You owe</Text>
              <Text style={[styles.breakdownValue, { color: colors.onPrimary }]}>
                {formatCurrency(balance.youOwe)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.settleUpBtn, { backgroundColor: '#FFFFFF' }]}
            onPress={() => navigation.navigate('SettlementCenter')}
            activeOpacity={0.9}
          >
            <Ionicons name="list-outline" size={20} color={colors.primary} />
            <Text style={[styles.settleUpText, { color: colors.primary }]}>View Settlements</Text>
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

          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('MainTabs', { screen: 'ContactsTab' })}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <MaterialIcons name="contacts" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.onSurface }]}>My{"\n"}Contacts</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={() => navigation.navigate('PaymentMethods')}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#E0E7FF' }]}>
              <MaterialIcons name="payment" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.actionLabel, { color: colors.onSurface }]}>Payment{"\n"}Methods</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Invitations */}
        {invites.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Pending Invitations</Text>
            </View>
            <View style={{ gap: Spacing.sm }}>
              {invites.map((inv) => (
                <View key={inv.invitationId} style={[styles.invitationCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                  <SmartImage
                    uri={inv.groupPhotoUrl}
                    thumbnailUri={inv.groupPhotoThumbnailUrl}
                    name={inv.groupName}
                    size={40}
                    mode="thumbnail"
                    fallbackIcon={
                      inv.groupType === 'Trip' ? 'flight' :
                      inv.groupType === 'Family' ? 'home' :
                      inv.groupType === 'Couple' ? 'favorite' :
                      inv.groupType === 'Flatmate' ? 'apartment' : 'groups'
                    }
                    style={{ borderRadius: 20 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.invitationTitle, { color: colors.onSurface }]}>{inv.groupName}</Text>
                    <Text style={[styles.invitationSub, { color: colors.onSurfaceVariant }]}>Invited by {inv.invitedByName}</Text>
                  </View>
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: colors.surfaceContainerLow }]}
                      onPress={() => declineGroupInvitation(inv.invitationId!, inv.groupId)}
                    >
                      <Ionicons name="close" size={20} color={colors.onSurface} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: colors.primary }]}
                      onPress={() => acceptGroupInvitation(inv.invitationId!, inv.groupId)}
                    >
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Settlement Reminders */}
        {reminders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Settlement Reminders</Text>
            </View>
            <View style={{ gap: Spacing.sm }}>
              {reminders.map((rem) => {
                const sender = allUsersMap.get(rem.senderUid);
                const senderName = sender?.name || rem.senderName || rem.data?.senderName || 'A friend';
                const senderPhoto = sender?.photoUrl || rem.senderPhotoUrl || rem.data?.senderPhotoUrl;
                const displayAmount = rem.amount || rem.data?.amount || 0;
                const displayGroupName = rem.groupName || rem.data?.groupName || 'a group';

                return (
                  <View key={rem.id || rem.notificationId} style={[styles.invitationCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                    <SmartImage
                      uri={senderPhoto}
                      name={senderName}
                      size={40}
                      mode="thumbnail"
                      style={{ borderRadius: 20 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.invitationTitle, { color: colors.onSurface }]}>
                        <Text style={{ fontWeight: 'bold' }}>{senderName}</Text> sent you reminder
                      </Text>
                      <Text style={[styles.invitationSub, { color: colors.onSurfaceVariant }]}>
                        to settle {formatCurrency(displayAmount)} in {displayGroupName}
                      </Text>
                    </View>
                    <View style={styles.invitationActions}>
                      <TouchableOpacity
                        style={[styles.actionIconBtn, { backgroundColor: colors.surfaceContainerLow }]}
                        onPress={() => handleDismissReminder(rem)}
                      >
                        <Ionicons name="close" size={20} color={colors.onSurface} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionIconBtn, { backgroundColor: colors.primary }]}
                        onPress={() => {
                          handleDismissReminder(rem);
                          navigation.navigate('SettleUp', { groupId: rem.groupId || rem.data?.groupId });
                        }}
                      >
                        <MaterialIcons name="payments" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Needs Attention */}
        {pendingConfirmations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Needs Attention</Text>
            </View>
            <View style={{ gap: Spacing.sm }}>
              {pendingConfirmations.map((s) => {
                const fromUser = allUsersMap.get(s.fromUserId);
                const fromName = fromUser?.name || 'A friend';
                const fromPhoto = fromUser?.photoUrl;
                const fromPhotoThumb = fromUser?.photoThumbnailUrl;

                return (
                  <View key={s.settlementId} style={[styles.invitationCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                    <SmartImage
                      uri={fromPhoto}
                      thumbnailUri={fromPhotoThumb}
                      name={fromName}
                      size={40}
                      mode="thumbnail"
                      fallbackIcon="person"
                      style={{ borderRadius: 20 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.invitationTitle, { color: colors.onSurface }]}>Confirm Settlement</Text>
                      <Text style={[styles.invitationSub, { color: colors.onSurfaceVariant }]}>
                        <Text style={{ fontWeight: 'bold', color: colors.onSurface }}>{fromName}</Text> paid you {formatCurrency(s.amount)}
                      </Text>
                    </View>
                    <View style={styles.invitationActions}>
                      <TouchableOpacity
                        style={[styles.actionIconBtn, { backgroundColor: '#EF4444' }]}
                        onPress={async () => {
                          if (s.settlementId) {
                            try {
                              await rejectSettlementInFirestore(s.settlementId);
                            } catch (e) {
                              console.error('Error rejecting settlement:', e);
                            }
                          }
                        }}
                      >
                        <Ionicons name="close" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionIconBtn, { backgroundColor: '#22C55E' }]}
                        onPress={() => handleConfirmPayment(s)}
                      >
                        <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Smart Insight Card */}
        <View style={styles.section}>
          <SmartInsight insights={monthlyInsights} expenses={[]} settlements={[]} />
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
                const target = item.targetUid ? allUsersMap.get(item.targetUid) : null;
                const actorName = item.actorUid === currentUser?.uid ? 'You' : actor?.name || 'Member';
                const targetName = item.targetUid === currentUser?.uid ? 'you' : target?.name || 'Member';
                const isNegative = item.type === 'expense' && item.actorUid !== currentUser?.uid;

                let actionText = '';
                if (item.type === 'expense') actionText = 'added';
                else if (item.type === 'settlement') actionText = 'recorded';
                else if (item.type === 'group') actionText = 'created';
                else if (item.type === 'reminder') actionText = `sent a reminder to ${targetName} for`;

                return (
                  <View key={item.id} style={styles.activityItem}>
                    <View style={[styles.activityDot, { backgroundColor: item.type === 'expense' ? '#3B82F6' : item.type === 'reminder' ? '#F59E0B' : '#10B981' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityTitle, { color: colors.onSurface }]}>
                        <Text style={{ fontWeight: 'bold' }}>{actorName}</Text> {actionText} <Text style={{ fontWeight: 'bold' }}>{item.title}</Text>
                      </Text>
                      <Text style={[styles.activitySub, { color: colors.onSurfaceVariant }]}>
                        {item.date} • {item.groupName}
                      </Text>
                    </View>
                    {item.amount > 0 && item.type !== 'reminder' && (
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
          {groups.map((group) => (
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
                <SmartImage
                  uri={group.photoUrl}
                  thumbnailUri={group.photoThumbnailUrl}
                  name={group.name}
                  size={40}
                  mode="thumbnail"
                  fallbackIcon={
                    group.groupType === 'Trip' ? 'flight' :
                    group.groupType === 'Family' ? 'home' :
                    group.groupType === 'Couple' ? 'favorite' :
                    group.groupType === 'Flatmate' ? 'apartment' : 'groups'
                  }
                  style={{ borderRadius: 8 }}
                />
                <View>
                  <Text style={[styles.sheetItemName, { color: colors.onSurface }]}>{group.name}</Text>
                  <Text style={[styles.sheetItemSub, { color: colors.onSurfaceVariant }]}>
                    {group.groupType} • {group.memberIds?.length || 0} members
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

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
    opacity: 0.7,
  },
  userName: {
    ...Typography.headlineSm,
    fontWeight: 'bold',
  },
  dynamicLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pendingText: {
    ...Typography.labelMd,
    fontWeight: '600',
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
    top: 10,
    right: 10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E11D48',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
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
    ...Shadows.card,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reviewBtnText: {
    color: '#FFFFFF',
    ...Typography.labelMd,
    fontWeight: '700',
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
  sheetItemName: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
  sheetItemSub: {
    ...Typography.bodySm,
    fontSize: 11,
    marginTop: 2,
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
