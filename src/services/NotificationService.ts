import messaging from '@react-native-firebase/messaging';
import { Alert, Platform } from 'react-native';
import { db, auth } from '../config/firebase';
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';

export type NotificationType = 'GROUP_INVITE' | 'REMINDER' | 'EXPENSE' | 'COMMENT' | 'SETTLEMENT';

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
}

/**
 * Native Firebase Cloud Messaging (FCM) Service
 * Strictly avoiding Expo Push APIs.
 */
export const NotificationService = {

  /**
   * Request permission and get FCM Token
   */
  async requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('FCM Authorization status:', authStatus);
      return await this.getFcmToken();
    }
    return null;
  },

  /**
   * Get Native FCM Token and save to Firestore
   */
  async getFcmToken() {
    try {
      // 1. Get Token
      const fcmToken = await messaging().getToken();

      if (fcmToken) {
        console.log('✅ Native FCM Token:', fcmToken);

        // 2. Save to Firestore for the current user
        const user = auth.currentUser;
        if (user) {
          await updateDoc(doc(db, 'users', user.uid), {
            fcmToken: fcmToken,
            updatedAt: serverTimestamp()
          });
          console.log('💾 FCM Token synced to Firestore');
        }
        return fcmToken;
      }
    } catch (error) {
      console.log('Error getting FCM token:', error);
    }
    return null;
  },

  /**
   * Listen for token refreshes
   */
  onTokenRefresh() {
    return messaging().onTokenRefresh(async (token) => {
      console.log('🔄 FCM Token Refreshed:', token);
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          fcmToken: token,
          updatedAt: serverTimestamp()
        });
      }
    });
  },

  /**
   * Initialize Listeners for Foreground/Background/Quit states
   */
  setupListeners(navigation: any) {
    // 1. Foreground Message Listener
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
      console.log('📩 Foreground FCM Message:', JSON.stringify(remoteMessage));

      // Optionally show an alert or custom toast
      Alert.alert(
        remoteMessage.notification?.title || 'New Notification',
        remoteMessage.notification?.body || ''
      );
    });

    // 2. Notification Opened Listener (App was in background)
    const unsubscribeOnOpened = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('👆 Notification caused app to open from background:', remoteMessage.data);
      this.handleNotificationNavigation(remoteMessage, navigation);
    });

    // 3. Initial Notification (App was in quit/killed state)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('🚀 Notification caused app to open from quit state:', remoteMessage.data);
          this.handleNotificationNavigation(remoteMessage, navigation);
        }
      });

    return () => {
      unsubscribeOnMessage();
      unsubscribeOnOpened();
    };
  },

  /**
   * Generic Navigation Handler based on notification data
   */
  handleNotificationNavigation(remoteMessage: any, navigation: any) {
    const data = remoteMessage.data;
    if (!data) return;

    if (data.type === 'EXPENSE' && data.groupId) {
      navigation.navigate('GroupDetail', { groupId: data.groupId, groupName: data.groupName || 'Group' });
    } else if (data.groupId) {
      navigation.navigate('GroupDetail', { groupId: data.groupId, groupName: data.groupName || 'Group' });
    }
  },

  /**
   * Send push notification via Firebase FCM v1 API
   * IMPORTANT: You need an Access Token (OAuth2) for this.
   */
  async sendPushNotification(targetFcmToken: string, title: string, body: string, data: any = {}) {
    if (!targetFcmToken) return;

    // Use your Firebase Project ID from firebaseConfig
    const PROJECT_ID = 'splitmate-d2d66';

    // NOTE: In a real production app, you should NEVER store your OAuth token on the client.
    // This call should happen from a Backend or Cloud Function.
    // For now, I will provide the structure as requested.

    const url = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

    const message = {
      message: {
        token: targetFcmToken,
        notification: {
          title: title,
          body: body,
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK', // standard key for opening app
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channel_id: 'default',
          }
        }
      }
    };

    try {
      // You must obtain this ACCESS_TOKEN via a secure method (explained in instructions)
      const ACCESS_TOKEN = 'YOUR_OAUTH2_ACCESS_TOKEN';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
        },
        body: JSON.stringify(message),
      });

      const resText = await response.text();
      console.log('FCM Send Response:', resText);
    } catch (error) {
      console.error('FCM Send Error:', error);
    }
  },

  /**
   * Notify User (Combined Firestore record + FCM Push)
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

      // 2. Fetch target user's FCM Token
      const userSnap = await getDoc(doc(db, 'users', targetUserId));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.fcmToken) {
          // 3. Send Native Push
          await this.sendPushNotification(
            userData.fcmToken,
            payload.title,
            payload.message,
            payload.data
          );
        }
      }
    } catch (e) {
      console.error('NotifyUser Error:', e);
    }
  },

  /**
   * Firestore-based real-time notification sync for UI
   */
  subscribeToInAppNotifications(userId: string, onUpdate: (notifs: AppNotification[]) => void) {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];
      onUpdate(notifs);
    });
  }
};
