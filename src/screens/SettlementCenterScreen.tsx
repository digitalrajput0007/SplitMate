import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { auth, db } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../services/currencyService';
import { SmartImage } from '../components/SmartImage';
import {
  subscribeToUserGroups,
  getAllUsersFromFirestore,
  subscribeToUserProfile,
  GroupData,
  ExpenseData,
  SettlementData,
  UserProfile,
  addSettlementToFirestore,
  sendPaymentReminder,
  canSendReminder,
} from '../services/firestoreService';
import { simplifyDebts, SimplifiedDebt } from '../services/debtSimplifier';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

type Props = NativeStackScreenProps<RootStackParamList, 'SettlementCenter'>;

interface GroupDebt extends SimplifiedDebt {
  groupId: string;
  groupName: string;
}

export default function SettlementCenterScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allDebts, setAllDebts] = useState<GroupDebt[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  // Listen to needed profiles for global settlements
  useEffect(() => {
    const unsubGroups = subscribeToUserGroups(currentUid, (groups) => {
      const uidsToFetch = new Set<string>();
      groups.forEach(g => {
        if (g.memberIds) g.memberIds.forEach((uid: string) => uidsToFetch.add(uid));
      });

      uidsToFetch.forEach(uid => {
        if (!memberProfiles[uid]) {
          subscribeToUserProfile(uid, (profile) => {
            if (profile) {
              setMemberProfiles(prev => ({
                ...prev,
                [uid]: profile
              }));
            }
          });
        }
      });
    });

    return () => unsubGroups();
  }, [currentUid]);

  const loadData = async () => {
    if (!currentUid) return;

    try {
      // 1. Fetch active groups
      const groupsQuery = query(collection(db, 'groups'), where('memberIds', 'array-contains', currentUid));
      const groupsSnap = await getDocs(groupsQuery);
      const activeGroups = groupsSnap.docs
        .map(d => ({ ...d.data(), groupId: d.id } as GroupData))
        .filter(g => !g.isArchived);

      if (activeGroups.length === 0) {
        setAllDebts([]);
        setLoading(false);
        return;
      }

      const gIds = activeGroups.map(g => g.groupId);

      // 2. Fetch expenses and settlements for ALL groups (limited to 30 for 'in' query)
      const expensesSnap = await getDocs(query(collection(db, 'expenses'), where('groupId', 'in', gIds.slice(0, 30))));
      const settlementsSnap = await getDocs(query(collection(db, 'settlements'), where('groupId', 'in', gIds.slice(0, 30))));

      const expData = expensesSnap.docs.map(d => d.data() as ExpenseData);
      const setData = settlementsSnap.docs.map(d => d.data() as SettlementData);

      // 3. Calculate simplified debts PER group
      const aggregated: GroupDebt[] = [];
      const uMap = memberProfiles; // Use the latest reactive map

      activeGroups.forEach(group => {
        const groupExps = expData.filter(e => e.groupId === group.groupId);
        const groupSets = setData.filter(s => s.groupId === group.groupId);

        // Build member profile subset for this group
        const profiles: Record<string, any> = {};
        group.memberIds.forEach(id => {
          const u = uMap[id];
          profiles[id] = {
            name: id === currentUid ? 'You' : (u?.name || 'Member'),
            paymentHandle: u?.paymentHandle || '',
            photoUrl: u?.photoUrl || '',
          };
        });

        const groupDebts = simplifyDebts(groupExps, groupSets, profiles);

        // Add group metadata and filter for current user
        groupDebts.forEach(debt => {
          if (debt.fromUserId === currentUid || debt.toUserId === currentUid) {
            aggregated.push({
              ...debt,
              groupId: group.groupId,
              groupName: group.name,
            });
          }
        });
      });

      setAllDebts(aggregated);
    } catch (error) {
      console.error('Error loading global settlements:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (Object.keys(memberProfiles).length > 0) {
      loadData();
    }
  }, [memberProfiles]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const youOwe = useMemo(() => allDebts.filter(d => d.fromUserId === currentUid), [allDebts]);
  const youAreOwed = useMemo(() => allDebts.filter(d => d.toUserId === currentUid), [allDebts]);

  const handleRecordSettlement = async (debt: GroupDebt) => {
    Alert.alert(
      'Mark as Settled',
      `Confirm that ${formatCurrency(debt.amount)} was paid between ${debt.fromName} and ${debt.toName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await addSettlementToFirestore({
                groupId: debt.groupId,
                fromUserId: debt.fromUserId,
                fromName: memberProfiles[debt.fromUserId]?.name || debt.fromName || 'Member',
                toUserId: debt.toUserId,
                toName: memberProfiles[debt.toUserId]?.name || debt.toName || 'Member',
                amount: debt.amount,
                status: 'pending',
              });
              Alert.alert(
                'Settlement Request Sent',
                `A settlement request has been sent to ${debt.toName}. The balance will be updated once confirmed.`
              );
              loadData();
            } catch (e) {
              Alert.alert('Error', 'Failed to send settlement request.');
            }
          },
        },
      ]
    );
  };

  const handleReminder = async (debt: GroupDebt) => {
    try {
      const allowed = await canSendReminder(debt.fromUserId, debt.groupId);
      if (!allowed) {
        Alert.alert('Reminder Sent', 'Next reminder available in 24 hours.');
        return;
      }
      await sendPaymentReminder(debt.fromUserId, debt.groupId, debt.groupName, debt.amount);
      Alert.alert('Success', `Reminder sent to ${debt.fromName}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to send reminder.');
    }
  };

  const renderDebtCard = (debt: GroupDebt, type: 'owe' | 'owed') => {
    const otherUser = type === 'owe'
      ? { name: debt.toName, photo: debt.toPhotoUrl, thumb: debt.toPhotoThumbnailUrl, handle: debt.toPaymentHandle }
      : { name: debt.fromName, photo: debt.fromPhotoUrl, thumb: debt.fromPhotoThumbnailUrl, handle: null };

    return (
      <TouchableOpacity
        key={debt.id}
        style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}
        onPress={() => navigation.navigate('SettleUp', { groupId: debt.groupId })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <SmartImage
            uri={otherUser.photo || undefined}
            thumbnailUri={otherUser.thumb || undefined}
            name={otherUser.name}
            mode="thumbnail"
            size={44}
            fallbackIcon="person"
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.onSurface }]}>{otherUser.name}</Text>
            <Text style={[styles.groupName, { color: colors.onSurfaceVariant }]}>{debt.groupName}</Text>
          </View>
          <Text style={[styles.amount, { color: type === 'owed' ? colors.positive : colors.error }]}>
            {formatCurrency(debt.amount)}
          </Text>
        </View>

        <View style={styles.actions}>
          {type === 'owe' ? (
            <>
              {otherUser.handle ? (
                <TouchableOpacity
                  style={[styles.primaryAction, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('SettleUp', { groupId: debt.groupId })}
                >
                  <MaterialIcons name="account-balance-wallet" size={16} color={colors.onPrimary} />
                  <Text style={[styles.actionTxt, { color: colors.onPrimary }]}>Pay via UPI</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.disabledAction, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={[styles.actionTxt, { color: colors.outline }]}>No UPI Available</Text>
                </View>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={[styles.primaryAction, { backgroundColor: colors.secondaryContainer }]}
              onPress={() => handleReminder(debt)}
            >
              <MaterialIcons name="notifications-active" size={16} color={colors.onSecondaryContainer} />
              <Text style={[styles.actionTxt, { color: colors.onSecondaryContainer }]}>Send Reminder</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.secondaryAction, { borderColor: colors.outlineVariant }]}
            onPress={() => handleRecordSettlement(debt)}
          >
            <Text style={[styles.secondaryActionTxt, { color: colors.onSurface }]}>Mark Settled</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.onBackground }]}>Settlement Center</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ marginTop: 12, color: colors.onSurfaceVariant }}>Calculating global balances...</Text>
          </View>
        ) : allDebts.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={[styles.emptyTitle, { color: colors.onBackground }]}>You're all settled!</Text>
            <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>No pending settlements across your groups.</Text>
          </View>
        ) : (
          <>
            {youOwe.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.error }]}>YOU OWE</Text>
                {youOwe.map(d => renderDebtCard(d, 'owe'))}
              </View>
            )}

            {youAreOwed.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.positive }]}>YOU ARE OWED</Text>
                {youAreOwed.map(d => renderDebtCard(d, 'owed'))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.titleMd, fontWeight: '700' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: 40, gap: Spacing.xl },
  center: { marginTop: 100, alignItems: 'center' },
  empty: { marginTop: 100, alignItems: 'center', gap: 8 },
  emoji: { fontSize: 64 },
  emptyTitle: { ...Typography.headlineSm, fontWeight: '700' },
  emptySub: { ...Typography.bodyMd, textAlign: 'center' },
  section: { gap: Spacing.md },
  sectionTitle: { ...Typography.labelLg, fontWeight: '800', letterSpacing: 1 },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
    ...Shadows.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  avatarTxt: { ...Typography.titleMd, fontWeight: '700' },
  name: { ...Typography.titleSm, fontWeight: '700' },
  groupName: { ...Typography.bodySm, fontSize: 11 },
  amount: { ...Typography.titleMd, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  primaryAction: { flex: 1.2, height: 40, borderRadius: BorderRadius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  disabledAction: { flex: 1.2, height: 40, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  secondaryAction: { flex: 1, height: 40, borderRadius: BorderRadius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionTxt: { ...Typography.labelMd, fontWeight: '700' },
  secondaryActionTxt: { ...Typography.labelMd, fontWeight: '600' },
});
