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
import { getUserProfileFromFirestore, getAllUsersFromFirestore } from '../services/firestoreService';
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

  const fetchUserData = useCallback(async () => {
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
    setDisplayName(activeUser.displayName || activeUser.email?.split('@')[0] || 'User');
    setDisplayEmail(activeUser.email || '');
    setPhotoUrl(activeUser.photoURL || '');

    try {
      const prof = await getUserProfileFromFirestore(activeUser.uid);
      if (prof) {
        if (prof.name) setDisplayName(prof.name);
        if (prof.email) setDisplayEmail(prof.email);
        if (prof.paymentHandle) setPaymentHandle(prof.paymentHandle);
        if (prof.photoUrl) setPhotoUrl(prof.photoUrl);
        if (prof.mobile) setDisplayMobile(prof.mobile);
      }
    } catch (err) {
      console.error('Firestore fetch error in AccountScreen:', err);
      Alert.alert('Error', 'Network error, check your connection');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

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
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topPadding }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topHeader}>
          <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Account</Text>
          <TouchableOpacity style={[styles.qrBtn, { backgroundColor: colors.primaryFixed }]} onPress={() => { setActiveQrTab('my'); setScannedUser(null); setScannedLock(false); setQrModalVisible(true); }}>
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
                <Text style={[styles.avatarText, { color: colors.onPrimaryContainer }]}>{displayName.charAt(0).toUpperCase()}</Text>
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
          <Text style={styles.sectionHeader}>Preferences</Text>
          <View style={styles.menuGroup}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('NotificationSettings')}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialIcons name="notifications-none" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.menuText}>Notifications</Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.outlineVariant} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('RecurringExpenses')}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialIcons name="autorenew" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.menuText}>Recurring Expenses & Subs</Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.outlineVariant} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('PrivacySecurity')}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialIcons name="security" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.menuText}>Privacy & Security</Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.outlineVariant} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Support</Text>
          <View style={styles.menuGroup}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setHelpModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialIcons name="help-outline" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.menuText}>Help Center & FAQ</Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.outlineVariant} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('ContactUs')}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialIcons name="mail-outline" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.menuText}>Contact Us</Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.outlineVariant} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleShareApp}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialIcons name="share" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.menuText}>Invite Friends</Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.outlineVariant} />
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => Alert.alert('Rate SplitMate', 'Thank you for rating SplitMate 5 stars!')}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <MaterialIcons name="star-outline" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.menuText}>Rate SplitMate</Text>
              <MaterialIcons name="chevron-right" size={24} color={Colors.outlineVariant} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutModalVisible(true)} activeOpacity={0.85}>
          <MaterialIcons name="logout" size={24} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>Made with ❤️ in India • v1.2.0</Text>
      </ScrollView>

      <Modal visible={logoutModalVisible} transparent animationType="fade" onRequestClose={() => setLogoutModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setLogoutModalVisible(false)}>
          <View style={styles.confirmDialog}>
            <MaterialIcons name="logout" size={32} color={Colors.error} style={{ alignSelf: 'center', marginBottom: 8 }} />
            <Text style={styles.confirmTitle}>Sign Out?</Text>
            <Text style={styles.confirmSub}>Are you sure? You'll need to sign in again.</Text>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity style={styles.cancelDialogBtn} onPress={() => setLogoutModalVisible(false)}>
                <Text style={styles.cancelDialogText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmLogoutBtn} onPress={confirmLogout}>
                <Text style={styles.confirmLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={helpModalVisible} transparent animationType="slide" onRequestClose={() => setHelpModalVisible(false)}>
        <View style={styles.lazyModalContainer}>
          <View style={styles.lazyModalHeader}>
            <Text style={styles.lazyModalTitle}>Help Center & FAQ</Text>
            <TouchableOpacity onPress={() => setHelpModalVisible(false)}>
              <MaterialIcons name="close" size={24} color={Colors.onSurface} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={styles.faqTitle}>How does SplitMate work?</Text>
            <Text style={styles.faqBody}>
              SplitMate automatically calculates net balances across your friends and groups so you always know who owes what.
            </Text>

            <Text style={[styles.faqTitle, { marginTop: 16 }]}>How do I settle up via UPI?</Text>
            <Text style={styles.faqBody}>
              Tap "Settle Up" on any group page, select UPI payment, and enter your UPI ID. SplitMate directly opens your installed UPI apps like PhonePe, Paytm, or Google Pay.
            </Text>

            <TouchableOpacity style={styles.fullHelpBtn} onPress={() => { setHelpModalVisible(false); navigation.navigate('HelpSupport'); }}>
              <Text style={styles.fullHelpText}>Open Full Support Page</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={qrModalVisible} transparent animationType="fade" onRequestClose={() => setQrModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setQrModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.qrCardExpanded}>
            <View style={styles.tabHeader}>
              <TouchableOpacity
                style={[styles.tabButton, activeQrTab === 'scan' && styles.tabButtonActive]}
                onPress={() => { setActiveQrTab('scan'); setScannedUser(null); setScannedNotFound(false); setScannedLock(false); }}
              >
                <MaterialIcons name="qr-code-scanner" size={22} color={activeQrTab === 'scan' ? Colors.primary : Colors.onSurfaceVariant} />
                <Text style={[styles.tabText, activeQrTab === 'scan' && styles.tabTextActive]}>Scan QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, activeQrTab === 'my' && styles.tabButtonActive]}
                onPress={() => setActiveQrTab('my')}
              >
                <MaterialIcons name="qr-code-2" size={22} color={activeQrTab === 'my' ? Colors.primary : Colors.onSurfaceVariant} />
                <Text style={[styles.tabText, activeQrTab === 'my' && styles.tabTextActive]}>My QR</Text>
              </TouchableOpacity>
            </View>

            {activeQrTab === 'my' ? (
              <View style={styles.tabContent}>
                <AppLogo size={56} />
                <Text style={styles.qrTitle}>{displayName}</Text>
                <View style={styles.qrBoxLarge}>
                  <QRCode
                    value={displayMobile || currentUser?.uid || 'SPLITMATE_USER'}
                    size={200}
                    color={Colors.primary}
                    backgroundColor={Colors.surfaceContainerLowest}
                  />
                </View>
                <Text style={styles.qrNote}>Scan this QR code using SplitMate to add me directly to your contacts.</Text>
              </View>
            ) : (
              <View style={styles.tabContent}>
                {!scannedUser && !scannedNotFound ? (
                  !permission?.granted ? (
                    <View style={styles.permissionBox}>
                      <MaterialIcons name="photo-camera" size={64} color={Colors.primary} />
                      <Text style={styles.scanInstruction}>Camera permission is required to scan SplitMate friend QR codes</Text>
                      <TouchableOpacity style={styles.grantCameraBtn} onPress={requestPermission}>
                        <Text style={styles.grantCameraText}>Grant Camera Access</Text>
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
                        <View style={styles.cameraCornerTL} />
                        <View style={styles.cameraCornerTR} />
                        <View style={styles.cameraCornerBL} />
                        <View style={styles.cameraCornerBR} />
                      </View>
                      <Text style={styles.realtimeScanPrompt}>Point camera at SplitMate QR</Text>
                    </View>
                  )
                ) : scannedNotFound ? (
                  <View style={styles.scannedUserCard}>
                    <View style={[styles.scannedAvatarCircle, { backgroundColor: '#FEE2E2' }]}>
                      <MaterialIcons name="person-off" size={36} color="#DC2626" />
                    </View>
                    <Text style={styles.scannedName}>User Not Found</Text>
                    <Text style={[styles.scannedEmail, { textAlign: 'center' }]}>
                      This QR code is not registered with an active SplitMate user account.
                    </Text>
                    <TouchableOpacity
                      style={styles.rescanBtn}
                      onPress={() => { setScannedNotFound(false); setScannedLock(false); }}
                    >
                      <Text style={styles.rescanBtnText}>Scan Again</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.scannedUserCard}>
                    <View style={styles.scannedAvatarCircleLarge}>
                      {scannedUser.photoUrl ? (
                        <Image source={{ uri: scannedUser.photoUrl }} style={styles.scannedAvatarImgLarge} />
                      ) : (
                        <Text style={styles.scannedAvatarTextLarge}>{scannedUser.name.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={styles.scannedNameLarge}>{scannedUser.name}</Text>
                    <Text style={styles.scannedMobileText}>{scannedUser.email}</Text>

                    <TouchableOpacity
                      style={styles.addContactActionBtnLarge}
                      onPress={handleAddScannedContact}
                      disabled={addingContact}
                    >
                      <Text style={styles.addContactActionText}>
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
