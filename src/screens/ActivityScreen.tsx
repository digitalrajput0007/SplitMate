import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  subscribeToUserGroups,
  subscribeUserActivityFeed,
  ActivityItem,
} from '../services/firestoreService';

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    // First get user group IDs
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

  return (
    <SafeAreaView style={styles.container}>
      <RNStatusBar backgroundColor={Colors.background} barStyle="dark-content" translucent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Activity Feed</Text>
        <Text style={styles.headerSub}>Live timeline of all group expenses & settlements</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : activities.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📜</Text>
            <Text style={styles.emptyTitle}>No Activity Yet</Text>
            <Text style={styles.emptySub}>
              Group expenses and recorded settlements will appear here in chronological order.
            </Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {activities.map((item) => (
              <View key={item.id} style={styles.feedCard}>
                <View style={styles.feedIconBox}>
                  <Text style={styles.feedEmoji}>{item.category ? item.category.split(' ')[0] : '💸'}</Text>
                </View>
                <View style={styles.feedContent}>
                  <Text style={styles.feedTitle}>{item.title}</Text>
                  <Text style={styles.feedSubtitle}>{item.subtitle}</Text>
                </View>
                <View style={styles.feedRight}>
                  <Text style={styles.feedAmount}>{formatCurrency(item.amount)}</Text>
                  <Text style={styles.feedDate}>{item.date}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  headerTitle: { ...Typography.headlineLgMobile, color: Colors.onBackground },
  headerSub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: Spacing.xs, marginBottom: Spacing.xs },
  loadingBox: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  emptyCard: {
    padding: Spacing.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginTop: Spacing.md,
  },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { ...Typography.titleMd, color: Colors.onBackground },
  emptySub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, textAlign: 'center' },
  feedList: { gap: Spacing.sm },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  feedIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedEmoji: { fontSize: 18 },
  feedContent: { flex: 1 },
  feedTitle: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
  feedSubtitle: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  feedRight: { alignItems: 'flex-end' },
  feedAmount: { ...Typography.titleMd, color: Colors.primary, fontWeight: '600' },
  feedDate: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
});
