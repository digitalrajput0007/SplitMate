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
import { M3BottomSheet } from '../components/M3BottomSheet';
import { useUserGroups } from '../hooks/useUserGroups';
import { formatCurrency } from '../services/currencyService';
import {
  UserProfile,
  getAllUsersFromFirestore,
  subscribeToUserProfile
} from '../services/firestoreService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FILTERS = ['All', 'You Owe', 'You Are Owed', 'Settled'];
const TYPE_OPTIONS: Array<{ id: string | null; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { id: null, label: 'All Types', icon: 'filter-list' },
  { id: 'Trip', label: 'Trip', icon: 'flight' },
  { id: 'Family', label: 'Family', icon: 'home' },
  { id: 'Couple', label: 'Couple', icon: 'favorite' },
  { id: 'Flatmate', label: 'Flatmate', icon: 'apartment' },
  { id: 'Other', label: 'Other', icon: 'more-horiz' },
];

export default function GroupsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const { groups, archivedGroups, groupBalances, loading, refreshGroups, currentUser } = useUserGroups();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeType, setActiveType] = useState<string | null>(null);
  const [showTypeSheet, setShowTypeSheet] = useState(false);
  const [allUsersMap, setAllUsersMap] = useState<Map<string, UserProfile>>(new Map());

  const [ownedExpanded, setOwnedExpanded] = useState(true);
  const [joinedExpanded, setJoinedExpanded] = useState(true);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  // Listen to needed user profiles for GroupCard avatars
  React.useEffect(() => {
    if (groups.length === 0 && archivedGroups.length === 0) return;

    const uidsToFetch = new Set<string>();
    [...groups, ...archivedGroups].forEach(g => {
      if (g.memberIds) {
        g.memberIds.forEach((uid: string) => uidsToFetch.add(uid));
      }
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
  }, [groups, archivedGroups]);

  const toggleOwned = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOwnedExpanded(!ownedExpanded);
  };

  const toggleJoined = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setJoinedExpanded(!joinedExpanded);
  };

  const toggleArchived = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setArchivedExpanded(!archivedExpanded);
  };

  const { owned, joined, archived } = useMemo(() => {
    const filterFn = (g: any) => {
      const balance = groupBalances[g.groupId] || 0;
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (activeFilter === 'You Owe') if (balance >= -0.05) return false;
      if (activeFilter === 'You Are Owed') if (balance <= 0.05) return false;
      if (activeFilter === 'Settled') if (Math.abs(balance) > 0.05) return false;

      if (activeType && g.groupType !== activeType) return false;

      return true;
    };

    const filteredActive = groups.filter(filterFn);
    const filteredArchived = archivedGroups.filter(filterFn);

    return {
      owned: filteredActive.filter(g => g.createdBy === currentUser?.uid),
      joined: filteredActive.filter(g => g.createdBy !== currentUser?.uid),
      archived: filteredArchived,
    };
  }, [groups, archivedGroups, searchQuery, activeFilter, groupBalances, currentUser?.uid]);

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  const renderGroupCard = React.useCallback((item: any, isOwner: boolean) => {
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
        thumbnailUri: profileMatch?.photoThumbnailUrl || undefined,
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
        groupPhotoThumbnailUrl={item.photoThumbnailUrl}
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
  }, [groupBalances, allUsersMap, navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      <View style={[styles.header, { paddingTop: topPadding }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Groups</Text>

        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <M3SearchBar
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search groups..."
              onClear={() => setSearchQuery('')}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.filterIconBtn,
              { backgroundColor: activeType ? colors.primary : colors.surfaceContainerHigh }
            ]}
            onPress={() => setShowTypeSheet(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="tune"
              size={22}
              color={activeType ? colors.onPrimary : colors.onSurfaceVariant}
            />
            {activeType && <View style={[styles.filterBadge, { backgroundColor: colors.error }]} />}
          </TouchableOpacity>
        </View>

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

            {/* Archived Groups Section */}
            {archived.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={toggleArchived}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={archivedExpanded ? "chevron-down" : "chevron-forward"}
                    size={20}
                    color={colors.outline}
                  />
                  <Text style={[styles.sectionTitle, { color: colors.outline }]}>
                    Archived Groups ({archived.length})
                  </Text>
                </TouchableOpacity>

                {archivedExpanded && (
                  <View style={[styles.sectionBody, { opacity: 0.8 }]}>
                    {archived.map(g => renderGroupCard(g, g.createdBy === currentUser?.uid))}
                  </View>
                )}
              </>
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

      <M3BottomSheet
        visible={showTypeSheet}
        onDismiss={() => setShowTypeSheet(false)}
        title="Filter by Group Type"
      >
        <View style={styles.sheetList}>
          {TYPE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={[
                styles.typeOption,
                activeType === opt.id && { backgroundColor: colors.primaryContainer }
              ]}
              onPress={() => {
                setActiveType(opt.id);
                setShowTypeSheet(false);
              }}
            >
              <MaterialIcons
                name={opt.icon}
                size={22}
                color={activeType === opt.id ? colors.primary : colors.onSurfaceVariant}
              />
              <Text style={[
                styles.typeOptionLabel,
                { color: activeType === opt.id ? colors.primary : colors.onSurface }
              ]}>
                {opt.label}
              </Text>
              {activeType === opt.id && (
                <MaterialIcons name="check" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </M3BottomSheet>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  filterRow: {
    gap: Spacing.sm,
    paddingBottom: 4,
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
  sheetList: {
    gap: 4,
    paddingBottom: 20,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: BorderRadius.md,
    gap: 16,
  },
  typeOptionLabel: {
    ...Typography.bodyLg,
    flex: 1,
    fontWeight: '500',
  },
});
