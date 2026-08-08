import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';
import { db, auth } from '../config/firebase';
import {
  doc,
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

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

      console.log('✅ Expo Push Token:', token);

      // Sync token to Firestore
      const user = auth.currentUser;
      if (user && token) {
        await updateDoc(doc(db, 'users', user.uid), {
          pushToken: token, // Changed from fcmToken to pushToken for Expo compatibility
          updatedAt: serverTimestamp()
        });
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
    if (!data) return;
    if (data.groupId) {
      navigation.navigate('GroupDetail', { groupId: data.groupId, groupName: data.groupName || 'Group' });
    }
  },

  /**
   * Notify User (In-App record + Expo Push)
   * The actual push delivery should ideally happen via Cloud Functions
   */
  async notifyUser(targetUserId: string, payload: { type: NotificationType; title: string; message: string; data: any }) {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid === targetUserId) return;

    try {
      // 1. Create In-App Notification in Firestore
      await addDoc(collection(db, 'notifications'), {
        userId: targetUserId,
        ...payload,
        isRead: false,
        createdAt: serverTimestamp(),
      });

      // Note: Triggering the push from the client is possible using Expo's API
      // but it's best handled by a Firestore-triggered Cloud Function.
    } catch (e) {
      console.error('NotifyUser Error:', e);
    }
  }
};
