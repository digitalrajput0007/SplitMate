import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Platform,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  subscribeToUserGroups,
  subscribeUserActivityFeed,
  subscribeToUserProfile,
  ActivityItem,
  UserProfile,
} from '../services/firestoreService';
import { SmartImage } from '../components/SmartImage';
import { EmptyStateIllustration } from '../components/EmptyIllustration';

export default function ActivityScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const currentUser = auth.currentUser;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activities.length === 0) return;

    const uidsToFetch = new Set<string>();
    activities.forEach(a => {
      if (a.actorUid) uidsToFetch.add(a.actorUid);
      if (a.targetUid) uidsToFetch.add(a.targetUid);
    });

    const unsubs: (() => void)[] = [];
    uidsToFetch.forEach(uid => {
      if (!userMap[uid]) {
        const unsub = subscribeToUserProfile(uid, (profile) => {
          if (profile) {
            setUserMap(prev => ({
              ...prev,
              [uid]: profile
            }));
          }
        });
        unsubs.push(unsub);
      }
    });

    return () => unsubs.forEach(u => u());
  }, [activities]);

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
    if (!user) return { name: 'Member', photo: null, thumb: null };
    return {
      name: uid === currentUser?.uid ? 'You' : user.name,
      photo: user.photoUrl,
      thumb: user.photoThumbnailUrl
    };
  };

  const renderActivityItem = ({ item }: { item: ActivityItem }) => {
    const actor = getActorInfo(item.actorUid);
    const displayTitle = item.type === 'group' ? item.title.replace(/\s+created$/i, '') : item.title;

    const handlePress = () => {
      if (item.type === 'expense' && item.id) {
        navigation.navigate('ExpenseDetail', { expenseId: item.id });
      } else if (item.type === 'group' && item.id) {
        navigation.navigate('GroupDetail', { groupId: item.id, groupName: displayTitle });
      }
    };

    return (
      <TouchableOpacity
        style={[styles.feedCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={styles.actorAvatarContainer}>
          <SmartImage
            uri={actor.photo || undefined}
            thumbnailUri={actor.thumb || undefined}
            name={actor.name}
            mode="thumbnail"
            size={44}
            fallbackIcon="person"
          />
        </View>
        <View style={styles.feedContent}>
          <Text style={[styles.feedTitle, { color: colors.onSurface }]}>
            <Text style={{ fontWeight: '700' }}>{actor.name}</Text> {item.type === 'group' ? 'created ' : 'added '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>{displayTitle}</Text>
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
      </TouchableOpacity>
    );
  };

  const HeaderComponent = () => (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Activity Feed</Text>
      <Text style={[styles.headerSub, { color: colors.onSurfaceVariant }]}>Real-time timeline of your group activity</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>Syncing timeline...</Text>
        </View>
      ) : activities.length === 0 ? (
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}>
          <HeaderComponent />
          <EmptyStateIllustration
            type="activity"
            title="No Activity Yet"
            description="When you or your group members add expenses, make payments, or create groups, real-time activity will show up here."
            actionLabel="View Groups"
            onActionPress={() => navigation.navigate('GroupsTab')}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderActivityItem}
          ListHeaderComponent={HeaderComponent}
          contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
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
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  actorAvatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
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
