import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { db, auth } from '../config/firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';

export type NotificationType = 'GROUP_INVITE' | 'REMINDER' | 'EXPENSE' | 'COMMENT' | 'SETTLEMENT' | 'payment_reminder' | 'group_invitation' | 'general';

export interface AppNotification {
  id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: {
    groupId?: string;
    expenseId?: string;
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: any;
  // Legacy fields
  notificationId?: string;
  recipientUid?: string;
  read?: boolean;
}

let cachedSyncedToken = '';

/**
 * Expo Push Notification Service
 * Compatible with Expo Go, Android, and iOS without native modules.
 */
export const NotificationService = {

  /**
   * Request permission and get Expo Push Token
   */
  async requestUserPermission() {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device.');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Permission for notifications not granted.');
        return null;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('splitmate_notifications_v1', {
          name: 'SplitMate Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0065F2',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          sound: 'default',
          enableVibrate: true,
          showBadge: true,
        });
      }

      // Try Expo Push Token first, fallback to Native FCM Device Token
      let token: string | null = null;
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch (expoPushErr: any) {
        console.warn('Expo Push Token error, falling back to Native Device Token:', expoPushErr?.message);
        const deviceTokenObj = await Notifications.getDevicePushTokenAsync();
        token = deviceTokenObj.data;
      }

      // Sync token to Firestore only if token has changed or not yet cached
      const user = auth.currentUser;
      if (user && token && cachedSyncedToken !== `${user.uid}_${token}`) {
        cachedSyncedToken = `${user.uid}_${token}`;
        await setDoc(doc(db, 'users', user.uid), {
          pushToken: token,
          fcmToken: token,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log(`[NotificationService] Synced push token for user ${user.uid}`);
      }
      return token;
    } catch (e) {
      console.error('Error getting push token:', e);
      return null;
    }
  },

  /**
   * Initialize Listeners for Foreground/Background
   */
  setupListeners(navigation: any) {
    // Listener for foreground notifications
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('📩 Foreground Notification:', notification);
      // Optionally show custom alert or badge
    });

    // Listener for notification taps (App was in background/quit)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('👆 Notification Tapped:', data);
      this.handleNotificationNavigation(data, navigation);
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  },

  handleNotificationNavigation(data: any, navigation: any) {
    if (!data || !navigation) return;
    console.log('[NotificationService] Navigating with payload data:', data);

    setTimeout(() => {
      try {
        const type = data.type || data.notificationType;

        if (type === 'GROUP_INVITE' || type === 'group_invitation') {
          navigation.navigate('Notifications');
        } else if (type === 'SETTLEMENT' || type === 'REMINDER' || type === 'payment_reminder') {
          if (data.groupId) {
            navigation.navigate('GroupDetail', {
              groupId: data.groupId,
              groupName: data.groupName || 'Group'
            });
          } else {
            navigation.navigate('SettlementCenter');
          }
        } else if (data.groupId) {
          navigation.navigate('GroupDetail', {
            groupId: data.groupId,
            groupName: data.groupName || 'Group'
          });
        } else {
          navigation.navigate('Notifications');
        }
      } catch (err) {
        console.error('[NotificationService] Navigation error:', err);
      }
    }, 200);
  },

  /**
   * Notify User (In-App record + Expo Push via Expo Push API)
   */
  async notifyUser(targetUserId: string, payload: { type: NotificationType; title: string; message: string; data: any }) {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid === targetUserId) return;

    try {
      // 1. Create In-App Notification in Firestore
      const notifRef = doc(collection(db, 'notifications'));
      await setDoc(notifRef, {
        id: notifRef.id,
        notificationId: notifRef.id,
        userId: targetUserId,
        recipientUid: targetUserId,
        senderUid: currentUser.uid,
        ...payload,
        isRead: false,
        read: false,
        createdAt: serverTimestamp(),
      });

      // 2. Fetch target user's pushToken and preferences from Firestore
      const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
      if (!targetUserDoc.exists()) return;

      const targetUserData = targetUserDoc.data();
      const pushToken = targetUserData?.pushToken || targetUserData?.fcmToken;
      const prefs = targetUserData?.preferences;

      // Respect user notification preferences
      if (prefs) {
        if (payload.type === 'GROUP_INVITE' && prefs.groupInvites === false) return;
        if (payload.type === 'EXPENSE' && prefs.expenseAlerts === false) return;
        if ((payload.type === 'REMINDER' || payload.type === 'payment_reminder') && prefs.settlementReminders === false) return;
      }

      // Send Push via Expo Push API if pushToken is available
      if (pushToken) {
        console.log(`[NotificationService] Sending push notification to token: ${pushToken}`);
        
        let pushPayload: any = {
          to: pushToken,
          sound: 'default',
          title: payload.title,
          body: payload.message,
          data: {
            ...payload.data,
            type: payload.type,
          },
          priority: 'high',
          channelId: 'splitmate_notifications_v1',
          _displayInForeground: true,
        };

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pushPayload),
        });
        const resData = await response.json();
        console.log('[NotificationService] Expo Push response:', resData);
      } else {
        console.warn(`[NotificationService] Cannot send push notification. Missing pushToken for user ${targetUserId}`);
      }
    } catch (e) {
      console.error('NotifyUser Error:', e);
    }
  }
};

