import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  Animated,
  Alert,
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
import { BalanceCard } from '../components/BalanceCard';
import { QuickActionTile } from '../components/QuickActionTile';
import { SectionHeader } from '../components/SectionHeader';
import { EmptyState } from '../components/EmptyState';
import { GroupCard } from '../components/GroupCard';
import AppLogo from '../components/AppLogo';
import { auth } from '../config/firebase';
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
  confirmSettlementInFirestore,
  rejectSettlementInFirestore,
  processDueRecurringExpenses,
} from '../services/firestoreService';
import { useUserGroups } from '../hooks/useUserGroups';
import { useHomeActions } from '../hooks/useHomeActions';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const currentUser = auth.currentUser;
  const { groups, groupBalances, loading: groupsLoading } = useUserGroups();
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
      <RNStatusBar
        backgroundColor={colors.background}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Sky-Blue Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <TouchableOpacity
              onPress={() => navigation.navigate('MainTabs', { screen: 'AccountTab' })}
              activeOpacity={0.8}
            >
              <SmartImage
                uri={userPhoto || undefined}
                thumbnailUri={userPhotoThumb || undefined}
                name={firstName || 'User'}
                size={46}
                mode="thumbnail"
                fallbackIcon="person"
                style={styles.profilePic}
              />
            </TouchableOpacity>

            <View>
              <View style={styles.brandRow}>
                <AppLogo size={16} />
                <Text style={[styles.brandTagline, { color: colors.primary }]}>SplitMate</Text>
              </View>
              <Text style={[styles.greetingTitle, { color: colors.onSurface }]}>
                {getGreeting()} {firstName || 'Friend'}
              </Text>
              {actionState.message ? (
                <TouchableOpacity onPress={handleActionCTA} style={styles.statusPill}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          actionState.priority === 'OWE' || actionState.priority === 'REMINDER'
                            ? colors.error
                            : colors.positive,
                      },
                    ]}
                  />
                  <Text style={[styles.statusText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    {actionState.message}
                  </Text>
                  <MaterialIcons name="chevron-right" size={14} color={colors.primary} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.notifBtn, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
            {hasUnreadNotifications && (
              <View style={[styles.notifBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.notifBadgeText}>
                  {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Sky-Blue Financial Overview Card */}
        <BalanceCard
          totalBalance={balance.totalBalance}
          youAreOwed={balance.youAreOwed}
          youOwe={balance.youOwe}
          onSettlePress={() => navigation.navigate('SettlementCenter')}
          onWalletPress={() => navigation.navigate('PaymentMethods')}
        />

        {/* Quick Actions Row */}
        <View style={styles.quickActionsRow}>
          <QuickActionTile
            label={'Add\nExpense'}
            iconName="add-circle"
            onPress={handleAddExpensePress}
            accentColor={colors.primary}
          />
          <QuickActionTile
            label={'My\nGroups'}
            iconName="groups"
            onPress={() => navigation.navigate('MainTabs', { screen: 'GroupsTab' })}
            accentColor="#0284C7"
          />
          <QuickActionTile
            label={'Settle\nUp'}
            iconName="swap-horizontal"
            iconType="ionicons"
            onPress={() => navigation.navigate('SettlementCenter')}
            accentColor="#0D9488"
          />
          <QuickActionTile
            label={'View\nActivity'}
            iconName="receipt-long"
            onPress={() => navigation.navigate('MainTabs', { screen: 'ActivityTab' })}
            accentColor="#8B5CF6"
          />
        </View>

        {/* Actionable Alerts (Invitations, Reminders, Confirmations) */}
        {invites.length > 0 && (
          <View style={styles.sectionContainer}>
            <SectionHeader title="Pending Invitations" subtitle={`${invites.length} pending`} />
            <View style={{ gap: Spacing.sm }}>
              {invites.map((inv) => (
                <View
                  key={inv.invitationId}
                  style={[
                    styles.alertCard,
                    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                  ]}
                >
                  <SmartImage
                    uri={inv.groupPhotoUrl}
                    thumbnailUri={inv.groupPhotoThumbnailUrl}
                    name={inv.groupName}
                    size={42}
                    mode="thumbnail"
                    fallbackIcon={
                      inv.groupType === 'Trip' ? 'flight' :
                      inv.groupType === 'Family' ? 'home' :
                      inv.groupType === 'Couple' ? 'favorite' :
                      inv.groupType === 'Flatmate' ? 'apartment' : 'groups'
                    }
                    style={{ borderRadius: 21 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertTitle, { color: colors.onSurface }]} numberOfLines={1}>
                      {inv.groupName}
                    </Text>
                    <Text style={[styles.alertSub, { color: colors.onSurfaceVariant }]}>
                      Invited by {inv.invitedByName}
                    </Text>
                  </View>
                  <View style={styles.alertActions}>
                    <TouchableOpacity
                      style={[styles.alertActionBtn, { backgroundColor: colors.surfaceContainerLow }]}
                      onPress={() => declineGroupInvitation(inv.invitationId!, inv.groupId)}
                    >
                      <Ionicons name="close" size={18} color={colors.onSurface} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.alertActionBtn, { backgroundColor: colors.primary }]}
                      onPress={() => acceptGroupInvitation(inv.invitationId!, inv.groupId)}
                    >
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {reminders.length > 0 && (
          <View style={styles.sectionContainer}>
            <SectionHeader title="Settlement Reminders" subtitle={`${reminders.length} reminder(s)`} />
            <View style={{ gap: Spacing.sm }}>
              {reminders.map((rem) => {
                const senderUid = rem.data?.senderUid || (rem as any).senderUid;
                const sender = senderUid ? allUsersMap.get(senderUid) : undefined;
                const senderName = sender?.name || (rem as any).senderName || rem.data?.senderName || 'A friend';
                const senderPhoto = sender?.photoUrl || rem.data?.senderPhotoUrl;
                const displayAmount = (rem as any).amount || rem.data?.amount || 0;
                const displayGroupName = (rem as any).groupName || rem.data?.groupName || 'a group';

                return (
                  <View
                    key={rem.id || rem.notificationId}
                    style={[
                      styles.alertCard,
                      { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                    ]}
                  >
                    <SmartImage
                      uri={senderPhoto}
                      name={senderName}
                      size={42}
                      mode="thumbnail"
                      style={{ borderRadius: 21 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, { color: colors.onSurface }]}>
                        <Text style={{ fontWeight: 'bold' }}>{senderName}</Text> sent reminder
                      </Text>
                      <Text style={[styles.alertSub, { color: colors.onSurfaceVariant }]}>
                        To settle {formatCurrency(displayAmount)} in {displayGroupName}
                      </Text>
                    </View>
                    <View style={styles.alertActions}>
                      <TouchableOpacity
                        style={[styles.alertActionBtn, { backgroundColor: colors.surfaceContainerLow }]}
                        onPress={() => handleDismissReminder(rem)}
                      >
                        <Ionicons name="close" size={18} color={colors.onSurface} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.alertActionBtn, { backgroundColor: colors.primary }]}
                        onPress={() => {
                          handleDismissReminder(rem);
                          navigation.navigate('SettleUp', { groupId: rem.groupId || rem.data?.groupId });
                        }}
                      >
                        <MaterialIcons name="payments" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {pendingConfirmations.length > 0 && (
          <View style={styles.sectionContainer}>
            <SectionHeader title="Needs Attention" subtitle="Confirm payments received" />
            <View style={{ gap: Spacing.sm }}>
              {pendingConfirmations.map((s) => {
                const fromUser = allUsersMap.get(s.fromUserId);
                const fromName = fromUser?.name || 'A friend';
                const fromPhoto = fromUser?.photoUrl;
                const fromPhotoThumb = fromUser?.photoThumbnailUrl;

                return (
                  <View
                    key={s.settlementId}
                    style={[
                      styles.alertCard,
                      { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                    ]}
                  >
                    <SmartImage
                      uri={fromPhoto}
                      thumbnailUri={fromPhotoThumb}
                      name={fromName}
                      size={42}
                      mode="thumbnail"
                      fallbackIcon="person"
                      style={{ borderRadius: 21 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertTitle, { color: colors.onSurface }]}>Payment Received</Text>
                      <Text style={[styles.alertSub, { color: colors.onSurfaceVariant }]}>
                        <Text style={{ fontWeight: 'bold', color: colors.onSurface }}>{fromName}</Text> paid you{' '}
                        {formatCurrency(s.amount)}
                      </Text>
                    </View>
                    <View style={styles.alertActions}>
                      <TouchableOpacity
                        style={[styles.alertActionBtn, { backgroundColor: colors.error }]}
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
                        <Ionicons name="close" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.alertActionBtn, { backgroundColor: colors.positive }]}
                        onPress={() => handleConfirmPayment(s)}
                      >
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Groups Preview Section */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="My Groups"
            actionText={groups.length > 0 ? 'See All' : undefined}
            onActionPress={() => navigation.navigate('MainTabs', { screen: 'GroupsTab' })}
          />

          {groupsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.md }} />
          ) : groups.length === 0 ? (
            <EmptyState
              icon="group-add"
              title="No Groups Yet"
              description="Create a group with flatmates, travel buddies, or friends to start sharing expenses seamlessly."
              actionLabel="Create a Group"
              onActionPress={() => navigation.navigate('CreateGroup')}
            />
          ) : (
            <View style={{ gap: Spacing.xs }}>
              {groups.slice(0, 3).map((group) => {
                const bal = groupBalances[group.groupId] || 0;
                const balLabel = bal > 0 ? 'owed' : bal < 0 ? 'owe' : 'settled';
                const balFormatted = formatCurrency(Math.abs(bal));

                return (
                  <GroupCard
                    key={group.groupId}
                    name={group.name}
                    groupPhotoUrl={group.photoUrl}
                    groupPhotoThumbnailUrl={group.photoThumbnailUrl}
                    groupType={group.groupType as any}
                    members={(group.memberIds || []).map((uid: string) => {
                      const u = allUsersMap.get(uid);
                      return { name: u?.name || 'Member', uri: u?.photoUrl, thumbnailUri: u?.photoThumbnailUrl };
                    })}
                    balanceLabel={balLabel}
                    balanceAmount={balFormatted}
                    onPress={() =>
                      navigation.navigate('GroupDetail', {
                        groupId: group.groupId,
                        groupName: group.name,
                      })
                    }
                    role={group.createdBy === currentUser?.uid ? 'owner' : 'member'}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* Smart Insight Analytics */}
        <View style={styles.sectionContainer}>
          <SmartInsight insights={monthlyInsights} expenses={[]} settlements={[]} />
        </View>

        {/* Recent Activity Section */}
        <View style={styles.sectionContainer}>
          <SectionHeader
            title="Recent Activity"
            actionText={recentActivities.length > 0 ? 'See All' : undefined}
            onActionPress={() => navigation.navigate('MainTabs', { screen: 'ActivityTab' })}
          />

          {recentActivities.length === 0 ? (
            <EmptyState
              icon="receipt"
              title="No Recent Activity"
              description="When you or your group members add expenses or settlements, they will appear here in real time."
              actionLabel="Add Expense"
              onActionPress={handleAddExpensePress}
            />
          ) : (
            <View style={{ gap: Spacing.xs }}>
              {recentActivities.map((item) => {
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

                const displayTitle = item.type === 'group' ? item.title.replace(/\s+created$/i, '') : item.title;

                const handleActivityPress = () => {
                  if (item.type === 'expense' && item.id) {
                    navigation.navigate('ExpenseDetail', { expenseId: item.id });
                  } else if (item.type === 'group' && item.id) {
                    navigation.navigate('GroupDetail', { groupId: item.id, groupName: displayTitle });
                  }
                };

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.activityRowCard,
                      { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                    ]}
                    onPress={handleActivityPress}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.activityDot,
                        {
                          backgroundColor:
                            item.type === 'expense'
                              ? colors.primary
                              : item.type === 'reminder'
                              ? colors.warning
                              : colors.positive,
                        },
                      ]}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.activityTitle, { color: colors.onSurface }]}>
                        <Text style={{ fontWeight: '700' }}>{actorName}</Text> {actionText}{' '}
                        <Text style={{ fontWeight: '700' }}>{displayTitle}</Text>
                      </Text>
                      <Text style={[styles.activitySub, { color: colors.onSurfaceVariant }]}>
                        {item.date} {item.groupName ? `• ${item.groupName}` : ''}
                      </Text>
                    </View>
                    {item.amount > 0 && item.type !== 'reminder' && (
                      <Text
                        style={[
                          styles.activityAmount,
                          { color: isNegative ? colors.error : colors.positive },
                        ]}
                      >
                        {isNegative ? '-' : '+'}
                        {formatCurrency(item.amount)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <BannerAdSlot />
      </ScrollView>

      {/* Dialog for No Groups */}
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

      {/* Select Group Bottom Sheet */}
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
            style={[styles.sheetAddBtn, { borderColor: colors.primary, backgroundColor: colors.surfaceContainerLow }]}
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
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
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
    gap: Spacing.sm,
    flex: 1,
  },
  profilePic: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: '#38BDF8',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  brandTagline: {
    ...Typography.bodySm,
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  greetingTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
    lineHeight: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    ...Typography.bodySm,
    fontSize: 11,
    maxWidth: 200,
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Shadows.card,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  sectionContainer: {
    gap: Spacing.xs,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  alertTitle: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
  alertSub: {
    ...Typography.bodySm,
    fontSize: 12,
    marginTop: 1,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 6,
  },
  alertActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityTitle: {
    ...Typography.bodyMd,
    fontSize: 13,
  },
  activitySub: {
    ...Typography.bodySm,
    fontSize: 11,
    marginTop: 2,
  },
  activityAmount: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
  sheetContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sheetItem: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  sheetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sheetItemName: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
  sheetItemSub: {
    ...Typography.bodySm,
    fontSize: 12,
  },
  sheetAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 6,
    marginTop: Spacing.xs,
  },
  sheetAddText: {
    ...Typography.labelLg,
    fontWeight: '600',
  },
});
