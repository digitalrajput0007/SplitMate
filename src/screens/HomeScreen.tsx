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
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { GroupCard } from '../components/GroupCard';
import { BannerAdSlot } from '../components/BannerAdSlot';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  subscribeToUserGroups,
  getUserProfileFromFirestore,
  subscribeUserBalanceSummary,
  getSavedUserContactsFromFirestore,
  subscribeToPendingInvitations,
  acceptGroupInvitation,
  declineGroupInvitation,
  getAllUsersFromFirestore,
  GroupData,
  UserProfile,
  UserBalanceSummary,
  GroupInvitation,
} from '../services/firestoreService';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const currentUser = auth.currentUser;

  const [firstName, setFirstName] = useState('');
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<GroupInvitation[]>([]);
  const [frequentContacts, setFrequentContacts] = useState<UserProfile[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<UserBalanceSummary>({
    totalBalance: 0,
    youAreOwed: 0,
    youOwe: 0,
  });
  const [loading, setLoading] = useState(true);

  const [allUsersMap, setAllUsersMap] = useState<Map<string, UserProfile>>(new Map());

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

  // Real-time Firestore subscriptions for Groups, Pending Invitations, and Balance Summary
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const unsubGroups = subscribeToUserGroups(currentUser.uid, (groupList) => {
      setGroups(groupList);
      setLoading(false);
    });

    const unsubInvites = subscribeToPendingInvitations(currentUser.uid, (invList) => {
      setPendingInvitations(invList);
    });

    const unsubBalance = subscribeUserBalanceSummary(currentUser.uid, (summary) => {
      setBalanceSummary(summary);
    });

    return () => {
      unsubGroups();
      unsubInvites();
      unsubBalance();
    };
  }, [currentUser]);

  const handleAcceptInv = async (inv: GroupInvitation) => {
    try {
      await acceptGroupInvitation(inv.invitationId, inv.groupId, currentUser?.uid || '', currentUser?.displayName || 'Member');
    } catch (e) {
      console.log('Error accepting invitation:', e);
    }
  };

  const handleDeclineInv = async (inv: GroupInvitation) => {
    try {
      await declineGroupInvitation(inv.invitationId);
    } catch (e) {
      console.log('Error declining invitation:', e);
    }
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Greeting */}
        <View style={styles.greeting}>
          <View style={styles.greetingTitleBox}>
            <Text style={[styles.greetingText, { color: colors.onBackground }]}>
              {firstName ? `Hello, ${firstName}!` : 'Hello!'}
            </Text>
            <Text style={[styles.greetingSubtext, { color: colors.onSurfaceVariant }]}>Here's your expense summary (INR)</Text>
          </View>
          <TouchableOpacity
            style={[styles.notifBtn, { backgroundColor: colors.surfaceContainerLow }]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Total Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.balanceLabel, { color: colors.onSurfaceVariant }]}>Total Balance</Text>
            {balanceSummary.youAreOwed < 0.05 && balanceSummary.youOwe < 0.05 ? (
              <View style={[styles.settledBadge, { backgroundColor: colors.positiveContainer }]}>
                <Text style={[styles.settledBadgeText, { color: colors.positiveText }]}>Settled</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.balanceRow}>
            <Text style={[styles.balanceCurrency, { color: colors.primary }]}>₹</Text>
            <Text style={[styles.balanceAmount, { color: colors.primary }]}>{balanceSummary.totalBalance.toFixed(2)}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <View style={styles.balanceSplit}>
            <View>
              <Text style={[styles.splitLabel, { color: colors.onSurfaceVariant }]}>You are owed</Text>
              <Text style={[styles.splitAmountPositive, { color: colors.positive }]}>{formatCurrency(balanceSummary.youAreOwed)}</Text>
            </View>
            <View style={styles.splitRight}>
              <Text style={[styles.splitLabel, { color: colors.onSurfaceVariant }]}>You owe</Text>
              <Text style={[styles.splitAmountNegative, { color: colors.error }]}>{formatCurrency(balanceSummary.youOwe)}</Text>
            </View>
          </View>
        </View>

        {/* Frequent Contacts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Frequent Contacts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ContactsTab')}>
              <Text style={[styles.createGroupLink, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contactsRow}>
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => navigation.navigate('ContactsPermission')}
            >
              <View style={[styles.addContactBtn, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
                <Text style={[styles.addContactIcon, { color: colors.primary }]}>+</Text>
              </View>
              <Text style={[styles.contactName, { color: colors.onSurfaceVariant }]}>Add</Text>
            </TouchableOpacity>
            {frequentContacts.map((contact) => (
              <TouchableOpacity
                key={contact.uid}
                style={styles.contactItem}
                onPress={() => navigation.navigate('CreateGroup')}
              >
                {contact.photoUrl ? (
                  <Image source={{ uri: contact.photoUrl }} style={styles.contactAvatar} />
                ) : (
                  <View style={[styles.contactAvatar, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainerHighest }]}>
                    <Text style={[styles.avatarInitial, { color: colors.primary }]}>{contact.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={[styles.contactName, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                  {contact.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
                <View key={inv.invitationId} style={[styles.invitationCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.primaryContainer }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.invitationTitle, { color: colors.onSurface }]}>You've been added to {inv.groupName}</Text>
                    <Text style={[styles.invitationSub, { color: colors.onSurfaceVariant }]}>Invited by {inv.invitedByName}</Text>
                  </View>
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={[styles.declineBtn, { backgroundColor: colors.surfaceContainerHighest }]}
                      onPress={() => handleDeclineInv(inv)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.declineBtnText, { color: colors.onSurfaceVariant }]}>Decline</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleAcceptInv(inv)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.acceptBtnText, { color: colors.onPrimary }]}>Accept</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Your Groups Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Your Groups</Text>
            <TouchableOpacity
              style={styles.createGroupBtn}
              onPress={() => navigation.navigate('CreateGroup')}
              activeOpacity={0.7}
            >
              <Text style={[styles.createGroupLink, { color: colors.primary }]}>+ Create Group</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : groups.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="group-add" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.onBackground }]}>No groups yet</Text>
              <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
                Create a group to start splitting expenses with friends and roommates.
              </Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('CreateGroup')}
                activeOpacity={0.8}
              >
                <Text style={[styles.emptyBtnText, { color: colors.onPrimary }]}>Create First Group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.groupsList}>
              {groups.map((group) => {
                const myUid = currentUser?.uid || '';
                const myShare = group.memberNetShares?.[myUid] || 0;
                let balanceLabel: 'owed' | 'owe' | 'settled' = 'settled';
                let balanceAmount = 'Settled up';

                if (myShare > 0.01) {
                  balanceLabel = 'owed';
                  balanceAmount = formatCurrency(myShare);
                } else if (myShare < -0.01) {
                  balanceLabel = 'owe';
                  balanceAmount = formatCurrency(Math.abs(myShare));
                }

                // Map member profile images accurately from Firestore lookup or group cache
                const membersWithImages = (group.members || []).map((m: any) => {
                  const mUid = m.uid || m.id;
                  const profileMatch = allUsersMap.get(mUid);
                  return {
                    name: m.displayName || m.name || profileMatch?.displayName || 'Member',
                    uri: m.photoURL || m.photoUrl || profileMatch?.photoURL || profileMatch?.photoUrl || undefined,
                  };
                });

                return (
                  <GroupCard
                    key={group.groupId}
                    name={group.name}
                    groupPhotoUrl={group.groupPhotoUrl}
                    groupType={group.groupType as any}
                    members={membersWithImages}
                    balanceLabel={balanceLabel}
                    balanceAmount={balanceAmount}
                    onPress={() =>
                      navigation.navigate('GroupDetail', {
                        groupId: group.groupId,
                        groupName: group.name,
                      })
                    }
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* AdMob Banner Slot */}
        <BannerAdSlot />
      </ScrollView>

      {/* FAB — Create Group */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('CreateGroup')}
        activeOpacity={0.85}
      >
        <Text style={[styles.fabIcon, { color: colors.onPrimary }]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 110,
    gap: Spacing.lg,
  },
  greeting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  greetingTitleBox: { flex: 1, marginRight: Spacing.md },
  greetingText: { ...Typography.headlineLgMobile },
  greetingSubtext: { ...Typography.bodyMd, marginTop: Spacing.xs },
  notifBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  notifIcon: { fontSize: 20 },
  balanceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    gap: Spacing.md,
    borderWidth: 1,
  },
  balanceLabel: { ...Typography.titleSm },
  settledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  settledBadgeText: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  balanceCurrency: { ...Typography.titleMd },
  balanceAmount: { ...Typography.numericDisplay },
  divider: { height: 1 },
  balanceSplit: { flexDirection: 'row', justifyContent: 'space-between' },
  splitRight: { alignItems: 'flex-end' },
  splitLabel: { ...Typography.bodyMd },
  splitAmountPositive: { ...Typography.titleMd, fontWeight: '600' },
  splitAmountNegative: { ...Typography.titleMd, fontWeight: '600' },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.titleMd, fontWeight: '600' },
  createGroupBtn: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm },
  createGroupLink: { ...Typography.labelLg },
  contactsRow: { gap: Spacing.md, paddingRight: Spacing.containerMargin },
  contactItem: { alignItems: 'center', gap: Spacing.xs, minWidth: 56 },
  contactAvatar: { width: 48, height: 48, borderRadius: 24 },
  avatarInitial: { ...Typography.titleSm, fontWeight: '600' },
  contactName: { ...Typography.labelMd },
  addContactBtn: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  addContactIcon: { fontSize: 24, fontWeight: '300' },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Shadows.card,
  },
  invitationTitle: {
    ...Typography.titleMd,
    fontWeight: '600',
  },
  invitationSub: {
    ...Typography.bodyMd,
    marginTop: 2,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: Spacing.md,
  },
  declineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  declineBtnText: {
    ...Typography.labelMd,
    fontWeight: '600',
  },
  acceptBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  acceptBtnText: {
    ...Typography.labelMd,
    fontWeight: '600',
  },
  groupsList: { gap: Spacing.sm },
  loadingBox: { paddingVertical: Spacing.xl, alignItems: 'center' },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    marginTop: Spacing.xs,
    ...Shadows.card,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { ...Typography.titleLg, fontWeight: '700' },
  emptySub: { ...Typography.bodyMd, textAlign: 'center', paddingHorizontal: 20 },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    ...Shadows.button,
  },
  emptyBtnText: { ...Typography.titleSm, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: Spacing.containerMargin,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  fabIcon: { fontSize: 28, lineHeight: 32, fontWeight: '300' },
});
