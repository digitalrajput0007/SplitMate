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
import { useTheme } from '../context/ThemeContext';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  subscribeToUserGroups,
  subscribeUserActivityFeed,
  ActivityItem,
} from '../services/firestoreService';

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Activity Feed</Text>
        <Text style={[styles.headerSub, { color: colors.onSurfaceVariant }]}>Live timeline of all group expenses & settlements</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : activities.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <Text style={styles.emptyEmoji}>📜</Text>
            <Text style={[styles.emptyTitle, { color: colors.onBackground }]}>No Activity Yet</Text>
            <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>
              Group expenses and recorded settlements will appear here in chronological order.
            </Text>
          </View>
        ) : (
          <View style={styles.feedList}>
            {activities.map((item) => (
              <View key={item.id} style={[styles.feedCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                <View style={[styles.feedIconBox, { backgroundColor: colors.surfaceContainerLow }]}>
                  <Text style={styles.feedEmoji}>{item.category ? item.category.split(' ')[0] : '💸'}</Text>
                </View>
                <View style={styles.feedContent}>
                  <Text style={[styles.feedTitle, { color: colors.onSurface }]}>{item.title}</Text>
                  <Text style={[styles.feedSubtitle, { color: colors.onSurfaceVariant }]}>{item.subtitle}</Text>
                </View>
                <View style={styles.feedRight}>
                  <Text style={[styles.feedAmount, { color: colors.primary }]}>{formatCurrency(item.amount)}</Text>
                  <Text style={[styles.feedDate, { color: colors.onSurfaceVariant }]}>{item.date}</Text>
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
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  headerTitle: { ...Typography.headlineLgMobile },
  headerSub: { ...Typography.bodyMd, marginTop: Spacing.xs, marginBottom: Spacing.xs },
  loadingBox: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { ...Typography.titleMd },
  emptySub: { ...Typography.bodyMd, textAlign: 'center' },
  feedList: { gap: Spacing.sm },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  feedIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedEmoji: { fontSize: 18 },
  feedContent: { flex: 1 },
  feedTitle: { ...Typography.titleSm, fontWeight: '600' },
  feedSubtitle: { ...Typography.labelMd, marginTop: 2 },
  feedRight: { alignItems: 'flex-end' },
  feedAmount: { ...Typography.titleMd, fontWeight: '600' },
  feedDate: { ...Typography.labelMd, marginTop: 2 },
});
