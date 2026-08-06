import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar as RNStatusBar,
  Platform,
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

const CATEGORIES = ['All', 'Trip', 'Family', 'Couple', 'Flatmate', 'Other'];

export default function GroupsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const { groups, groupBalances, loading, refreshGroups, currentUser } = useUserGroups();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [allUsersMap, setAllUsersMap] = useState<Map<string, UserProfile>>(new Map());

  // Fetch all users for GroupCard avatars
  React.useEffect(() => {
    getAllUsersFromFirestore().then((users) => {
      const uMap = new Map<string, UserProfile>();
      users.forEach((u) => uMap.set(u.uid, u));
      setAllUsersMap(uMap);
    });
  }, []);

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || g.groupType === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [groups, searchQuery, selectedCategory]);

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.onSurface }]}>Your Groups</Text>
      <M3SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search groups..."
        onClear={() => setSearchQuery('')}
      />
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => (
          <M3Chip
            label={item}
            selected={selectedCategory === item}
            onPress={() => setSelectedCategory(item)}
          />
        )}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.groupId}
        contentContainerStyle={[styles.listContent, { paddingTop: topPadding }]}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={refreshGroups} tintColor={colors.primary} />
        }
        renderItem={({ item }) => {
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

          const membersWithImages = (item.memberIds || []).map((mUid) => {
            const profileMatch = allUsersMap.get(mUid);
            return {
              name: profileMatch?.name || 'Member',
              uri: profileMatch?.photoUrl || undefined,
            };
          });

          return (
            <View style={styles.cardWrapper}>
              <GroupCard
                name={item.name}
                groupPhotoUrl={item.photoUrl}
                groupType={item.groupType as any}
                members={membersWithImages}
                balanceLabel={balanceLabel}
                balanceAmount={balanceAmount}
                onPress={() =>
                  navigation.navigate('GroupDetail', {
                    groupId: item.groupId,
                    groupName: item.name,
                  })
                }
              />
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={64} color={colors.outlineVariant} />
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                {searchQuery || selectedCategory !== 'All'
                  ? "No groups match your filters"
                  : "You haven't joined any groups yet"}
              </Text>
            </View>
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )
        }
      />

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
  listContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
  },
  header: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.headlineSm,
    fontWeight: 'bold',
    marginBottom: Spacing.xs,
  },
  categoryList: {
    gap: Spacing.sm,
    paddingBottom: 4,
  },
  cardWrapper: {
    marginBottom: Spacing.md,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.bodyLg,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingBox: {
    marginTop: 60,
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
