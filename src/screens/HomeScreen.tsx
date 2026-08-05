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
import { GroupCard } from '../components/GroupCard';
import { BannerAdSlot } from '../components/BannerAdSlot';
import { auth } from '../config/firebase';
import { getCurrencyConfig, formatCurrency } from '../services/currencyService';
import {
  subscribeToUserGroups,
  getUserProfileFromFirestore,
  subscribeUserBalanceSummary,
  getAllUsersFromFirestore,
  GroupData,
  UserProfile,
  UserBalanceSummary,
} from '../services/firestoreService';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const currencyConfig = getCurrencyConfig();

  const currentUser = auth.currentUser;

  const [firstName, setFirstName] = useState('');
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [frequentContacts, setFrequentContacts] = useState<UserProfile[]>([]);
  const [balanceSummary, setBalanceSummary] = useState<UserBalanceSummary>({
    totalBalance: 0,
    youAreOwed: 0,
    youOwe: 0,
  });
  const [loading, setLoading] = useState(true);

  // Resolve display name: Firestore profile → Auth displayName → email prefix → generic
  useEffect(() => {
    const resolveDisplayName = async () => {
      if (currentUser?.uid) {
        const profile = await getUserProfileFromFirestore(currentUser.uid);
        if (profile?.name) {
          setFirstName(profile.name.split(' ')[0]);
          return;
        }
      }
      if (currentUser?.displayName) {
        setFirstName(currentUser.displayName.split(' ')[0]);
      } else if (currentUser?.email) {
        setFirstName(currentUser.email.split('@')[0]);
      } else {
        setFirstName('there');
      }
    };
    resolveDisplayName();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    // Subscribe to User Groups
    const unsubGroups = subscribeToUserGroups(currentUser.uid, (firestoreGroups) => {
      setGroups(firestoreGroups);
      setLoading(false);
    });

    // Subscribe to Realtime Balance Calculations across all expenses & settlements
    const unsubBalance = subscribeUserBalanceSummary(currentUser.uid, (summary) => {
      setBalanceSummary(summary);
    });

    // Load Frequent Contacts
    getAllUsersFromFirestore().then((users) => {
      const otherUsers = users.filter((u) => u.uid !== currentUser.uid);
      setFrequentContacts(otherUsers.slice(0, 6));
    });

    return () => {
      unsubGroups();
      unsubBalance();
    };
  }, [currentUser]);

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.sm;

  return (
    <View style={styles.container}>
      <RNStatusBar backgroundColor={Colors.background} barStyle="dark-content" translucent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting Header */}
        <View style={styles.greeting}>
          <View style={styles.greetingTitleBox}>
            <Text style={styles.greetingText}>Hey, {firstName} 👋</Text>
            <Text style={styles.greetingSubtext}>Here's your expense summary ({currencyConfig.code})</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Total Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceCurrency}>{currencyConfig.symbol}</Text>
            <Text style={styles.balanceAmount}>{balanceSummary.totalBalance.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.balanceSplit}>
            <View>
              <Text style={styles.splitLabel}>You are owed</Text>
              <Text style={styles.splitAmountPositive}>{formatCurrency(balanceSummary.youAreOwed)}</Text>
            </View>
            <View style={styles.splitRight}>
              <Text style={styles.splitLabel}>You owe</Text>
              <Text style={styles.splitAmountNegative}>{formatCurrency(balanceSummary.youOwe)}</Text>
            </View>
          </View>
        </View>

        {/* Frequent Contacts Section (Stitch Design Specification) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Frequent Contacts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ContactsTab')}>
              <Text style={styles.createGroupLink}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contactsRow}>
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => navigation.navigate('ContactsPermission')}
            >
              <View style={styles.addContactBtn}>
                <Text style={styles.addContactIcon}>+</Text>
              </View>
              <Text style={styles.contactName}>Add</Text>
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
                  <View style={[styles.contactAvatar, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={styles.avatarInitial}>{contact.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.contactName} numberOfLines={1}>
                  {contact.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Your Groups */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Groups ({groups.length})</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateGroup')}
              style={styles.createGroupBtn}
            >
              <Text style={styles.createGroupLink}>+ Create Group</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No groups yet!</Text>
              <Text style={styles.emptySub}>Create a group to start splitting bills with friends.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CreateGroup')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyBtnText}>+ Create Your First Group</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.groupsList}>
              {groups.map((g) => (
                <GroupCard
                  key={g.groupId}
                  name={g.name}
                  members={g.memberIds.map((id, index) => ({ name: `Member ${index + 1}` }))}
                  balanceLabel={g.balanceLabel || 'settled'}
                  balanceAmount={g.balanceAmount || formatCurrency(0)}
                  onPress={() =>
                    navigation.navigate('GroupDetail', {
                      groupId: g.groupId,
                      groupName: g.name,
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>

        {/* Google AdMob Banner Placement — Below Group List */}
        <BannerAdSlot />
      </ScrollView>

      {/* FAB — Create Group */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateGroup')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
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
  greetingText: { ...Typography.headlineLgMobile, color: Colors.onBackground },
  greetingSubtext: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: Spacing.xs },
  notifBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerLow,
  },
  notifIcon: { fontSize: 20 },
  balanceCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  balanceLabel: { ...Typography.titleSm, color: Colors.onSurfaceVariant },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  balanceCurrency: { ...Typography.titleMd, color: Colors.primary },
  balanceAmount: { ...Typography.numericDisplay, color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.divider },
  balanceSplit: { flexDirection: 'row', justifyContent: 'space-between' },
  splitRight: { alignItems: 'flex-end' },
  splitLabel: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  splitAmountPositive: { ...Typography.titleMd, color: Colors.positive, fontWeight: '600' },
  splitAmountNegative: { ...Typography.titleMd, color: Colors.error, fontWeight: '600' },
  section: { gap: Spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600' },
  createGroupBtn: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm },
  createGroupLink: { ...Typography.labelLg, color: Colors.primary },
  contactsRow: { gap: Spacing.md, paddingRight: Spacing.containerMargin },
  contactItem: { alignItems: 'center', gap: Spacing.xs, minWidth: 56 },
  contactAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceContainerHighest },
  avatarInitial: { ...Typography.titleSm, color: Colors.primary, fontWeight: '600' },
  contactName: { ...Typography.labelMd, color: Colors.onSurfaceVariant },
  addContactBtn: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5, borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center', justifyContent: 'center',
  },
  addContactIcon: { fontSize: 24, color: Colors.primary, fontWeight: '300' },
  groupsList: { gap: Spacing.sm },
  loadingBox: { paddingVertical: Spacing.xl, alignItems: 'center' },
  emptyCard: {
    padding: Spacing.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600' },
  emptySub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  emptyBtnText: { ...Typography.titleSm, color: Colors.primary },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: Spacing.containerMargin,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  fabIcon: { fontSize: 28, color: Colors.onPrimary, lineHeight: 32, fontWeight: '300' },
});
