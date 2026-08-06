import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar as RNStatusBar,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { GroupCard } from '../components/GroupCard';
import { M3SearchBar } from '../components/M3SearchBar';
import { M3Chip } from '../components/M3Chip';
import { useUserGroups } from '../hooks/useUserGroups';
import { formatCurrency } from '../services/currencyService';
import { UserProfile, getAllUsersFromFirestore } from '../services/firestoreService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FILTERS = ['All', 'You Owe', 'You Are Owed', 'Settled'];

export default function GroupsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const { groups, groupBalances, loading, refreshGroups, currentUser } = useUserGroups();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [allUsersMap, setAllUsersMap] = useState<Map<string, UserProfile>>(new Map());

  const [ownedExpanded, setOwnedExpanded] = useState(true);
  const [joinedExpanded, setJoinedExpanded] = useState(true);

  // Fetch all users for GroupCard avatars
  React.useEffect(() => {
    getAllUsersFromFirestore().then((users) => {
      const uMap = new Map<string, UserProfile>();
      users.forEach((u) => uMap.set(u.uid, u));
      setAllUsersMap(uMap);
    });
  }, []);

  const toggleOwned = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOwnedExpanded(!ownedExpanded);
  };

  const toggleJoined = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setJoinedExpanded(!joinedExpanded);
  };

  const { owned, joined } = useMemo(() => {
    const filtered = groups.filter((g) => {
      const balance = groupBalances[g.groupId] || 0;
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeFilter === 'You Owe') return balance < -0.05;
      if (activeFilter === 'You Are Owed') return balance > 0.05;
      if (activeFilter === 'Settled') return Math.abs(balance) <= 0.05;

      return true;
    });

    return {
      owned: filtered.filter(g => g.createdBy === currentUser?.uid),
      joined: filtered.filter(g => g.createdBy !== currentUser?.uid),
    };
  }, [groups, searchQuery, activeFilter, groupBalances, currentUser?.uid]);

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  const renderGroupCard = (item: any, isOwner: boolean) => {
    const myShare = groupBalances[item.groupId] || 0;
    let balanceLabel: 'owed' | 'owe' | 'settled' = 'settled';
    let balanceAmount = 'Settled up';

    if (myShare > 0.05) {
      balanceLabel = 'owed';
      balanceAmount = formatCurrency(myShare);
    } else if (myShare < -0.05) {
      balanceLabel = 'owe';
      balanceAmount = formatCurrency(Math.abs(myShare));
    }

    const membersWithImages = (item.memberIds || []).map((mUid: string) => {
      const profileMatch = allUsersMap.get(mUid);
      return {
        name: profileMatch?.name || 'Member',
        uri: profileMatch?.photoUrl || undefined,
      };
    });

    const lastActivityText = item.createdAt
      ? `Updated ${new Date(item.createdAt.seconds * 1000).toLocaleDateString()}`
      : undefined;

    return (
      <GroupCard
        key={item.groupId}
        name={item.name}
        groupPhotoUrl={item.photoUrl}
        groupType={item.groupType as any}
        members={membersWithImages}
        balanceLabel={balanceLabel}
        balanceAmount={balanceAmount}
        role={isOwner ? 'owner' : 'member'}
        lastActivity={lastActivityText}
        onPress={() =>
          navigation.navigate('GroupDetail', {
            groupId: item.groupId,
            groupName: item.name,
          })
        }
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      <View style={[styles.header, { paddingTop: topPadding }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Groups</Text>
        <M3SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search groups..."
          onClear={() => setSearchQuery('')}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <M3Chip
              key={f}
              label={f}
              selected={activeFilter === f}
              onPress={() => setActiveFilter(f)}
            />
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refreshGroups} tintColor={colors.primary} />
        }
      >
        {loading && groups.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Your Groups Section */}
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={toggleOwned}
              activeOpacity={0.7}
            >
              <Ionicons
                name={ownedExpanded ? "chevron-down" : "chevron-forward"}
                size={20}
                color={colors.onSurfaceVariant}
              />
              <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
                Your Groups ({owned.length})
              </Text>
            </TouchableOpacity>

            {ownedExpanded && (
              <View style={styles.sectionBody}>
                {owned.length > 0 ? (
                  owned.map(g => renderGroupCard(g, true))
                ) : (
                  <View style={[styles.emptyBox, { borderColor: colors.divider }]}>
                    <Text style={[styles.emptyText, { color: colors.outline }]}>
                      You haven't created any groups yet.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Joined Groups Section */}
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={toggleJoined}
              activeOpacity={0.7}
            >
              <Ionicons
                name={joinedExpanded ? "chevron-down" : "chevron-forward"}
                size={20}
                color={colors.onSurfaceVariant}
              />
              <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
                Joined Groups ({joined.length})
              </Text>
            </TouchableOpacity>

            {joinedExpanded && (
              <View style={styles.sectionBody}>
                {joined.length > 0 ? (
                  joined.map(g => renderGroupCard(g, false))
                ) : (
                  <View style={[styles.emptyBox, { borderColor: colors.divider }]}>
                    <Text style={[styles.emptyText, { color: colors.outline }]}>
                      You haven't joined any groups yet.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('CreateGroup')}
        activeOpacity={0.85}
      >
        <MaterialIcons name="add" size={28} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.containerMargin,
    gap: Spacing.md,
    paddingBottom: Spacing.md,
  },
  title: {
    ...Typography.headlineSm,
    fontWeight: 'bold',
  },
  filterRow: {
    gap: Spacing.sm,
    paddingBottom: 4,
    paddingHorizontal: Spacing.containerMargin,
  },
  scrollContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 120,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  sectionTitle: {
    ...Typography.labelLg,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionBody: {
    gap: Spacing.xs,
  },
  emptyBox: {
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: BorderRadius.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  emptyText: {
    ...Typography.bodyMd,
    textAlign: 'center',
  },
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
});
