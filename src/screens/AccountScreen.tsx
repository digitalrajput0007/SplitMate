import React, { useState, useEffect, useCallback, Suspense } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  Alert,
  Modal,
  StatusBar as RNStatusBar,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import { signOutUser } from '../services/authService';
import {
  getUserProfileFromFirestore,
  getAllUsersFromFirestore,
  subscribeToUserProfile
} from '../services/firestoreService';
import { getCurrencyConfig } from '../services/currencyService';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import AppLogo from '../components/AppLogo';
import { M3Skeleton } from '../components/M3Skeleton';
import QRCode from 'react-native-qrcode-svg';

let CameraView: any = View;
let useCameraPermissions: any = () => [{ granted: false }, () => { }];
if (Platform.OS !== 'web') {
  try {
    const cameraModule = require('expo-camera');
    CameraView = cameraModule.CameraView;
    useCameraPermissions = cameraModule.useCameraPermissions;
  } catch (e) {
    console.log('Camera native module notice:', e);
  }
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AccountScreen() {
  const navigation = useNavigation<NavigationProp>();
  const currencyConfig = getCurrencyConfig();
  const { themeMode, colors, isDark } = useTheme();
  const currentUser = auth.currentUser;

  const [permission, requestPermission] = useCameraPermissions();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || 'User');
  const [displayEmail, setDisplayEmail] = useState(currentUser?.email || '');
  const [displayMobile, setDisplayMobile] = useState('');
  const [paymentHandle, setPaymentHandle] = useState('');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photoURL || '');
  const [profileLoading, setProfileLoading] = useState(true);

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [activeQrTab, setActiveQrTab] = useState<'my' | 'scan'>('my');
  const [scannedUser, setScannedUser] = useState<any | null>(null);
  const [scannedNotFound, setScannedNotFound] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [scannedLock, setScannedLock] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);

  useEffect(() => {
    const activeUser = auth.currentUser;
    if (!activeUser?.uid) {
      setDisplayName('User');
      setDisplayEmail('');
      setPaymentHandle('');
      setPhotoUrl('');
      setDisplayMobile('');
      setProfileLoading(false);
      return;
    }

    // Initial sync from Auth
    setDisplayName(activeUser.displayName || activeUser.email?.split('@')[0] || 'User');
    setDisplayEmail(activeUser.email || '');
    setPhotoUrl(activeUser.photoURL || '');

    // Listen for real-time Firestore updates
    const unsubscribe = subscribeToUserProfile(activeUser.uid, (prof) => {
      if (prof) {
        if (prof.name !== undefined) setDisplayName(prof.name);
        if (prof.email !== undefined) setDisplayEmail(prof.email);
        if (prof.paymentHandle !== undefined) setPaymentHandle(prof.paymentHandle);
        if (prof.photoUrl !== undefined) setPhotoUrl(prof.photoUrl);
        if (prof.mobile !== undefined) setDisplayMobile(prof.mobile);
      }
      setProfileLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scannedLock || scannedUser || scannedNotFound) return;
    setScannedLock(true);

    try {
      const cleanedData = data.trim();
      let extractedMobile = cleanedData.replace(/[^0-9]/g, '').slice(-10);

      const allUsers = await getAllUsersFromFirestore();

      const matchedUser = allUsers.find((u) => {
        if (!u.mobile) return false;
        const normalized = u.mobile.replace(/[^0-9]/g, '').slice(-10);
        return normalized === extractedMobile || u.uid === cleanedData;
      });

      if (matchedUser) {
        setScannedUser(matchedUser);
        setScannedNotFound(false);
      } else {
        setScannedNotFound(true);
      }
    } catch (e) {
      setScannedNotFound(true);
    }
  };

  const handleAddScannedContact = async () => {
    if (!scannedUser) return;
    setAddingContact(true);
    setTimeout(() => {
      setAddingContact(false);
      Alert.alert('Contact Added', `${scannedUser.name} has been added to your SplitMate contacts!`);
      setScannedUser(null);
      setScannedLock(false);
      setQrModalVisible(false);
    }, 600);
  };

  const confirmLogout = async () => {
    setLogoutModalVisible(false);
    try {
      await signOutUser();
      setDisplayName('User');
      setDisplayEmail('');
      setDisplayMobile('');
      setPaymentHandle('');
      setPhotoUrl('');
      navigation.reset({ index: 0, routes: [{ name: 'SignIn' }] });
    } catch (e: any) {
      Alert.alert('Logout Error', 'Couldn\'t sign out, please try again');
    }
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Hey! Join me on SplitMate to split expenses & settle up seamlessly! Download: https://splitmate.app',
      });
    } catch (err) {
      console.log('Share error:', err);
    }
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      {/* Header */}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topHeader}>
          <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Account</Text>
          <TouchableOpacity style={[styles.qrBtn, { backgroundColor: colors.surfaceContainerLow }]} onPress={() => { setActiveQrTab('my'); setScannedUser(null); setScannedLock(false); setQrModalVisible(true); }}>
            <MaterialIcons name="qr-code-2" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {profileLoading ? (
          <View style={[styles.userCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <M3Skeleton width={56} height={56} style={{ borderRadius: 28 }} />
            <View style={{ flex: 1, gap: 8 }}>
              <M3Skeleton width="60%" height={18} />
              <M3Skeleton width="80%" height={14} />
              <M3Skeleton width="40%" height={14} />
            </View>
          </View>
        ) : (
          <View style={[styles.userCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primaryContainer }]}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={[styles.avatarText, { color: colors.onPrimaryContainer }]}>
                  {displayName
                    .trim()
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'U'}
                </Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.onSurface }]}>{displayName}</Text>
              <Text style={[styles.userEmail, { color: colors.onSurfaceVariant }]}>{displayEmail}</Text>
              <Text style={[styles.userHandle, { color: colors.primary }]}>
                {paymentHandle ? `${currencyConfig.paymentHandleLabel.split(' ')[0]}: ${paymentHandle}` : 'No payment handle added'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>Account Settings</Text>
          <View style={[styles.menuGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('ProfileEdit')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="person-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.onSurface }]}>Personal Information</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.divider }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('PaymentMethods')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="account-balance-wallet" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.onSurface }]}>Payment Methods & UPI</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>Preferences</Text>
          <View style={[styles.menuGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('AppTheme')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="palette" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuText, { color: colors.onSurface }]}>App Theme</Text>
                <Text style={[{ color: colors.onSurfaceVariant, fontSize: 13, marginTop: 2 }]}>
                  {themeMode === 'System' ? 'System Default' : themeMode === 'Dark' ? 'Dark Theme' : 'Light Theme'}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.divider }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('NotificationSettings')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="notifications-none" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.onSurface }]}>Notifications</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.divider }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('RecurringExpenses')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="autorenew" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.onSurface }]}>Recurring Expenses & Subs</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.divider }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('PrivacySecurity')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="security" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.onSurface }]}>Privacy & Security</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>Support</Text>
          <View style={[styles.menuGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setHelpModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="help-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.onSurface }]}>Help Center & FAQ</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.divider }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('ContactUs')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="mail-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.onSurface }]}>Contact Us</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.divider }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleShareApp}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="share" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.onSurface }]}>Invite Friends</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.divider }]} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => Alert.alert('Rate SplitMate', 'Thank you for rating SplitMate 5 stars!')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="star-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.onSurface }]}>Rate SplitMate</Text>
              <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]} onPress={() => setLogoutModalVisible(true)} activeOpacity={0.85}>
          <MaterialIcons name="logout" size={24} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>Made with ❤️ in India • v1.2.0</Text>
      </ScrollView>

      <Modal visible={logoutModalVisible} transparent animationType="fade" onRequestClose={() => setLogoutModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setLogoutModalVisible(false)}>
          <View style={[styles.confirmDialog, { backgroundColor: colors.surfaceContainerLowest }]}>
            <MaterialIcons name="logout" size={32} color={colors.error} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={[styles.confirmTitle, { color: colors.onSurface }]}>Sign Out?</Text>
            <Text style={[styles.confirmSub, { color: colors.onSurfaceVariant }]}>Are you sure? You'll need to sign in again.</Text>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity style={[styles.cancelDialogBtn, { backgroundColor: colors.surfaceContainerHigh }]} onPress={() => setLogoutModalVisible(false)}>
                <Text style={[styles.cancelDialogText, { color: colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmLogoutBtn, { backgroundColor: colors.error }]} onPress={confirmLogout}>
                <Text style={[styles.confirmLogoutText, { color: colors.onError }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={helpModalVisible} transparent animationType="slide" onRequestClose={() => setHelpModalVisible(false)}>
        <View style={[styles.lazyModalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.lazyModalHeader, { borderBottomColor: colors.outlineVariant }]}>
            <Text style={[styles.lazyModalTitle, { color: colors.onBackground }]}>Help Center & FAQ</Text>
            <TouchableOpacity onPress={() => setHelpModalVisible(false)}>
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={[styles.faqTitle, { color: colors.onSurface }]}>How does SplitMate work?</Text>
            <Text style={[styles.faqBody, { color: colors.onSurfaceVariant }]}>
              SplitMate automatically calculates net balances across your friends and groups so you always know who owes what.
            </Text>

            <Text style={[styles.faqTitle, { color: colors.onSurface, marginTop: 16 }]}>How do I settle up via UPI?</Text>
            <Text style={[styles.faqBody, { color: colors.onSurfaceVariant }]}>
              Tap "Settle Up" on any group page, select UPI payment, and enter your UPI ID. SplitMate directly opens your installed UPI apps like PhonePe, Paytm, or Google Pay.
            </Text>

            <TouchableOpacity style={[styles.fullHelpBtn, { backgroundColor: colors.primary }]} onPress={() => { setHelpModalVisible(false); navigation.navigate('HelpSupport'); }}>
              <Text style={[styles.fullHelpText, { color: colors.onPrimary }]}>Open Full Support Page</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={qrModalVisible} transparent animationType="fade" onRequestClose={() => setQrModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setQrModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.qrCardExpanded, { backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={[styles.tabHeader, { borderBottomColor: colors.outlineVariant }]}>
              <TouchableOpacity
                style={[styles.tabButton, activeQrTab === 'scan' && { borderBottomColor: colors.primary }]}
                onPress={() => { setActiveQrTab('scan'); setScannedUser(null); setScannedNotFound(false); setScannedLock(false); }}
              >
                <MaterialIcons name="qr-code-scanner" size={22} color={activeQrTab === 'scan' ? colors.primary : colors.onSurfaceVariant} />
                <Text style={[styles.tabText, { color: activeQrTab === 'scan' ? colors.primary : colors.onSurfaceVariant }]}>Scan QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeQrTab === 'my' && { borderBottomColor: colors.primary }]}
                onPress={() => setActiveQrTab('my')}
              >
                <MaterialIcons name="qr-code-2" size={22} color={activeQrTab === 'my' ? colors.primary : colors.onSurfaceVariant} />
                <Text style={[styles.tabText, { color: activeQrTab === 'my' ? colors.primary : colors.onSurfaceVariant }]}>My QR</Text>
              </TouchableOpacity>
            </View>

            {activeQrTab === 'my' ? (
              <View style={styles.tabContent}>
                <AppLogo size={56} />
                <Text style={[styles.qrTitle, { color: colors.onSurface }]}>{displayName}</Text>
                <View style={[styles.qrBoxLarge, { backgroundColor: '#FFFFFF' }]}>
                  <QRCode
                    value={displayMobile || currentUser?.uid || 'SPLITMATE_USER'}
                    size={200}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                </View>
                <Text style={[styles.qrNote, { color: colors.onSurfaceVariant }]}>Scan this QR code using SplitMate to add me directly to your contacts.</Text>
              </View>
            ) : (
              <View style={styles.tabContent}>
                {!scannedUser && !scannedNotFound ? (
                  !permission?.granted ? (
                    <View style={styles.permissionBox}>
                      <MaterialIcons name="photo-camera" size={64} color={colors.primary} />
                      <Text style={[styles.scanInstruction, { color: colors.onSurfaceVariant }]}>Camera permission is required to scan SplitMate friend QR codes</Text>
                      <TouchableOpacity style={[styles.grantCameraBtn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
                        <Text style={[styles.grantCameraText, { color: colors.onPrimary }]}>Grant Camera Access</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.realtimeCameraFrameLarge}>
                      <CameraView
                        style={styles.cameraViewStyle}
                        facing="back"
                        onBarcodeScanned={scannedLock ? undefined : handleBarcodeScanned}
                      />
                      <View style={styles.cameraOverlayFrame}>
                        <View style={[styles.cameraCornerTL, { borderColor: colors.primary }]} />
                        <View style={[styles.cameraCornerTR, { borderColor: colors.primary }]} />
                        <View style={[styles.cameraCornerBL, { borderColor: colors.primary }]} />
                        <View style={[styles.cameraCornerBR, { borderColor: colors.primary }]} />
                      </View>
                      <Text style={[styles.realtimeScanPrompt, { color: '#FFFFFF' }]}>Point camera at SplitMate QR</Text>
                    </View>
                  )
                ) : scannedNotFound ? (
                  <View style={styles.scannedUserCard}>
                    <View style={[styles.scannedAvatarCircle, { backgroundColor: colors.errorContainer }]}>
                      <MaterialIcons name="person-off" size={36} color={colors.error} />
                    </View>
                    <Text style={[styles.scannedName, { color: colors.onSurface }]}>User Not Found</Text>
                    <Text style={[styles.scannedEmail, { textAlign: 'center', color: colors.onSurfaceVariant }]}>
                      This QR code is not registered with an active SplitMate user account.
                    </Text>
                    <TouchableOpacity
                      style={[styles.rescanBtn, { backgroundColor: colors.surfaceContainerHigh }]}
                      onPress={() => { setScannedNotFound(false); setScannedLock(false); }}
                    >
                      <Text style={[styles.rescanBtnText, { color: colors.onSurface }]}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.scannedUserCard}>
                    <View style={[styles.scannedAvatarCircleLarge, { backgroundColor: colors.primaryContainer }]}>
                      {scannedUser.photoUrl ? (
                        <Image source={{ uri: scannedUser.photoUrl }} style={styles.scannedAvatarImgLarge} />
                      ) : (
                        <Text style={[styles.scannedAvatarTextLarge, { color: colors.onPrimaryContainer }]}>{scannedUser.name.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={[styles.scannedNameLarge, { color: colors.onSurface }]}>{scannedUser.name}</Text>
                    <Text style={[styles.scannedMobileText, { color: colors.onSurfaceVariant }]}>{scannedUser.email}</Text>

                    <TouchableOpacity
                      style={[styles.addContactActionBtnLarge, { backgroundColor: colors.primary }]}
                      onPress={handleAddScannedContact}
                      disabled={addingContact}
                    >
                      <Text style={[styles.addContactActionText, { color: colors.onPrimary }]}>
                        {addingContact ? 'Adding Friend...' : 'Confirm & Add as Friend'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelScanBtn}
                      onPress={() => { setScannedUser(null); setScannedLock(false); }}
                    >
                      <Text style={styles.cancelScanText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.closeQrBtn} onPress={() => setQrModalVisible(false)}>
              <Text style={styles.closeQrText}>Close Window</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  headerTitle: { ...Typography.headlineLgMobile, color: Colors.onBackground, fontWeight: '700' },
  qrBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { ...Typography.headlineLgMobile, color: Colors.onPrimaryContainer },
  userInfo: { flex: 1 },
  userName: { ...Typography.titleMd, color: Colors.onSurface, fontWeight: '600' },
  userEmail: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, fontSize: 13 },
  userHandle: { ...Typography.labelMd, color: Colors.primary, marginTop: 2, fontWeight: '600' },
  editProfileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { gap: Spacing.xs },
  sectionHeader: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    paddingLeft: Spacing.xs,
    marginTop: Spacing.xs,
  },
  menuGroup: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    minHeight: 48,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { ...Typography.titleSm, color: Colors.onSurface, flex: 1, fontWeight: '500' },
  rightValueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  rightValue: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, fontWeight: '500' },
  menuDivider: { height: 1, backgroundColor: Colors.divider, marginLeft: 56 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.errorContainer,
    marginTop: Spacing.sm,
  },
  logoutText: { ...Typography.titleMd, color: Colors.error, fontWeight: '600' },
  footerText: { ...Typography.labelMd, color: Colors.onSurfaceVariant, textAlign: 'center', opacity: 0.7, marginBottom: Spacing.md },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  qrCard: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    ...Shadows.dialog,
  },
  qrTitle: { ...Typography.titleMd, color: Colors.onSurface, fontWeight: '700' },
  qrHandle: { ...Typography.bodyMd, color: Colors.primary, fontWeight: '600' },
  qrBox: {
    padding: 16,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    marginVertical: 8,
  },
  qrNote: { ...Typography.labelMd, color: Colors.onSurfaceVariant, textAlign: 'center' },
  closeQrBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  closeQrText: { ...Typography.titleSm, color: Colors.onPrimary },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    padding: 4,
    width: '100%',
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: Colors.surfaceContainerLowest,
    ...Shadows.card,
  },
  tabText: {
    ...Typography.titleSm,
    color: Colors.onSurfaceVariant,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  tabContent: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
  },
  scannerBox: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  scanTargetFrame: {
    width: 140,
    height: 140,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  scanInstruction: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  simulateScanBtn: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    marginTop: 4,
  },
  simulateScanText: {
    ...Typography.labelLg,
    color: Colors.primary,
  },
  scannedUserCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.lg,
    padding: 16,
    gap: 6,
    marginVertical: 8,
  },
  scannedAvatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  scannedAvatarImg: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  scannedAvatarText: {
    ...Typography.headlineSm,
    color: Colors.onPrimaryContainer,
  },
  scannedName: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  scannedEmail: {
    ...Typography.bodySm,
    color: Colors.onSurfaceVariant,
  },
  handleBadge: {
    backgroundColor: Colors.accentTealContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    marginTop: 2,
  },
  handleBadgeText: {
    ...Typography.labelMd,
    color: Colors.accentTeal,
  },
  addContactActionBtn: {
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: 10,
  },
  addContactActionText: {
    ...Typography.titleSm,
    color: Colors.onPrimary,
    fontWeight: '700',
  },
  qrCardExpanded: {
    width: '100%',
    maxWidth: 420,
    minHeight: 520,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl + 4,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    ...Shadows.dialog,
  },
  qrBoxLarge: {
    padding: 20,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.xl,
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  realtimeCameraFrameLarge: {
    width: 270,
    height: 270,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  scannedAvatarCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scannedAvatarImgLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  scannedAvatarTextLarge: {
    ...Typography.headlineLgMobile,
    color: Colors.onPrimaryContainer,
  },
  scannedNameLarge: {
    ...Typography.headlineSm,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  scannedMobileText: {
    ...Typography.titleSm,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  addContactActionBtnLarge: {
    backgroundColor: Colors.primary,
    width: '100%',
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginTop: 14,
  },
  rescanBtn: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    marginTop: 12,
  },
  rescanBtnText: {
    ...Typography.titleSm,
    color: Colors.primary,
  },
  cancelScanBtn: {
    paddingVertical: 8,
    marginTop: 4,
  },
  cancelScanText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  permissionBox: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  grantCameraBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    marginTop: 8,
  },
  grantCameraText: {
    ...Typography.titleSm,
    color: Colors.onPrimary,
  },
  realtimeCameraFrame: {
    width: 220,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  cameraViewStyle: {
    width: '100%',
    height: '100%',
  },
  cameraOverlayFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 20,
  },
  cameraCornerTL: { position: 'absolute', top: 12, left: 12, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary },
  cameraCornerTR: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: Colors.primary },
  cameraCornerBL: { position: 'absolute', bottom: 12, left: 12, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: Colors.primary },
  cameraCornerBR: { position: 'absolute', bottom: 12, right: 12, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: Colors.primary },
  realtimeScanPrompt: {
    position: 'absolute',
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  confirmDialog: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: 20,
    ...Shadows.dialog,
  },
  confirmTitle: {
    ...Typography.titleLg,
    color: Colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmSub: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelDialogBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
  },
  cancelDialogText: {
    ...Typography.titleSm,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  confirmLogoutBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error,
    alignItems: 'center',
  },
  confirmLogoutText: {
    ...Typography.titleSm,
    color: Colors.onError,
    fontWeight: '600',
  },
  lazyModalContainer: {
    flex: 1,
    marginTop: 80,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    ...Shadows.dialog,
  },
  lazyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  lazyModalTitle: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  faqTitle: {
    ...Typography.titleSm,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  faqBody: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
    lineHeight: 20,
  },
  fullHelpBtn: {
    backgroundColor: Colors.primaryFixed,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: 24,
  },
  fullHelpText: {
    ...Typography.titleSm,
    color: Colors.primary,
    fontWeight: '600',
  },
});
