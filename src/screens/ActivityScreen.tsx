import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  subscribeToUserGroups,
  subscribeUserActivityFeed,
  getAllUsersFromFirestore,
  ActivityItem,
  UserProfile,
} from '../services/firestoreService';

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const currentUser = auth.currentUser;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user profiles for avatar resolution
    getAllUsersFromFirestore().then((users) => {
      const mapping: Record<string, UserProfile> = {};
      users.forEach(u => mapping[u.uid] = u);
      setUserMap(mapping);
    });
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const unsubGroups = subscribeToUserGroups(currentUser.uid, (groups) => {
      const gIds = groups.map((g) => g.groupId);
      if (gIds.length === 0) {
        setActivities([]);
        setLoading(false);
        return;
      }

      const unsubFeed = subscribeUserActivityFeed(gIds, (feedItems) => {
        setActivities(feedItems);
        setLoading(false);
      });

      return () => unsubFeed();
    });

    return () => unsubGroups();
  }, [currentUser]);

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.sm;

  const getActorInfo = (uid: string) => {
    const user = userMap[uid];
    if (!user) return { name: 'Member', photo: null };
    return {
      name: uid === currentUser?.uid ? 'You' : user.name,
      photo: user.photoUrl
    };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Activity Feed</Text>
        <Text style={[styles.headerSub, { color: colors.onSurfaceVariant }]}>Real-time timeline of your group activity</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Syncing timeline...</Text>
          </View>
        ) : activities.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: colors.surfaceContainerLow }]}>
              <MaterialIcons name="history" size={48} color={colors.outline} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.onBackground }]}>No activity yet</Text>
            <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
              New expenses, settlements, and groups will appear here as they happen.
            </Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {activities.map((item) => {
              const actor = getActorInfo(item.actorUid);
              return (
                <View key={item.id} style={[styles.feedCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                  {/* Actor Avatar */}
                  <View style={[styles.actorAvatar, { backgroundColor: colors.primaryFixed }]}>
                    {actor.photo ? (
                      <Image source={{ uri: actor.photo }} style={styles.avatarImg} />
                    ) : (
                      <Text style={[styles.avatarLetter, { color: colors.primary }]}>
                        {actor.name.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>

                  <View style={styles.feedContent}>
                    <Text style={[styles.feedTitle, { color: colors.onSurface }]}>
                      <Text style={{ fontWeight: '700' }}>{actor.name}</Text> {item.type === 'group' ? 'created ' : 'added '}
                      <Text style={{ color: colors.primary, fontWeight: '600' }}>{item.title}</Text>
                    </Text>
                    <Text style={[styles.feedSubtitle, { color: colors.onSurfaceVariant }]}>{item.subtitle}</Text>
                    <Text style={[styles.feedDate, { color: colors.outline }]}>{item.date}</Text>
                  </View>

                  {item.amount > 0 && (
                    <View style={styles.feedRight}>
                      <Text style={[styles.feedAmount, { color: item.type === 'settlement' ? colors.positive : colors.onSurface }]}>
                        {formatCurrency(item.amount)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  headerTitle: { ...Typography.headlineLgMobile, fontWeight: '700' },
  headerSub: { ...Typography.bodyMd, marginTop: Spacing.xs, marginBottom: Spacing.xs },
  loadingBox: { paddingVertical: Spacing.xxl, alignItems: 'center', gap: Spacing.sm },
  loadingText: { ...Typography.bodyMd },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    marginTop: Spacing.lg,
    ...Shadows.card,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: { ...Typography.titleLg, fontWeight: '700' },
  emptySub: { ...Typography.bodyMd, textAlign: 'center', paddingHorizontal: 20 },
  feedList: { gap: Spacing.md },
  feedCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  actorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarLetter: { ...Typography.titleMd, fontWeight: '700' },
  feedContent: { flex: 1, gap: 2 },
  feedTitle: { ...Typography.bodyLg, lineHeight: 20 },
  feedSubtitle: { ...Typography.bodyMd, opacity: 0.8 },
  feedDate: { ...Typography.labelMd, marginTop: 4 },
  feedRight: { justifyContent: 'center' },
  feedAmount: { ...Typography.titleMd, fontWeight: '700' },
});
