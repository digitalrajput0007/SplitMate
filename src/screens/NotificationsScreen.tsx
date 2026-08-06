import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import { formatCurrency } from '../services/currencyService';
import {
  subscribeToNotifications,
  markNotificationAsRead,
  AppNotification,
} from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export default function NotificationsScreen({ navigation }: Props) {
  const currentUser = auth.currentUser;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const unsub = subscribeToNotifications(currentUser.uid, (notifList) => {
      setNotifications(notifList);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  const handlePressNotif = async (item: AppNotification) => {
    if (!item.read) {
      await markNotificationAsRead(item.notificationId);
    }
    // Optionally navigate to group or expense
    if (item.groupId) {
      navigation.navigate('GroupDetail', { groupId: item.groupId, groupName: item.groupName });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 24 }} />
        ) : notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySub}>You are all caught up! New payment reminders will show up here.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {notifications.map((item) => (
              <TouchableOpacity
                key={item.notificationId}
                style={[styles.card, !item.read && { backgroundColor: Colors.primary + '08', borderColor: Colors.primary }]}
                onPress={() => handlePressNotif(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconBox, { backgroundColor: item.type === 'payment_reminder' ? Colors.error + '10' : Colors.surfaceContainerLow }]}>
                  <MaterialIcons
                    name={item.type === 'payment_reminder' ? "priority-high" : "notifications"}
                    size={20}
                    color={item.type === 'payment_reminder' ? Colors.error : Colors.primary}
                  />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.title, !item.read && { fontWeight: '700' }]}>{item.title}</Text>
                  <Text style={styles.subtitle}>{item.message}</Text>
                  <Text style={styles.date}>
                    {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                  </Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl },
  emptyCard: {
    padding: Spacing.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { ...Typography.titleMd, color: Colors.onBackground },
  emptySub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, textAlign: 'center' },
  list: { gap: Spacing.sm },
  card: {
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
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  title: { ...Typography.bodyLg, color: Colors.onSurface, fontWeight: '600', fontSize: 14 },
  subtitle: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  date: { ...Typography.labelMd, color: Colors.outline, fontSize: 10, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  }
});
