import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { OutlinedInput } from '../components/OutlinedInput';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../config/firebase';
import { useTheme } from '../context/ThemeContext';
import { updateUserProfile } from '../services/authService';
import {
  saveUserProfileToFirestore,
  getUserProfileFromFirestore,
  isMobileNumberRegistered,
} from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

export default function ProfileEditScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;

  const [name, setName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [paymentHandle, setPaymentHandle] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      if (!currentUser) return;
      try {
        const profile = await getUserProfileFromFirestore(currentUser.uid);
        if (profile) {
          setName(profile.name || '');
          setPhotoUrl(profile.photoUrl || currentUser.photoURL || '');
          setPaymentHandle(profile.paymentHandle || '');
          const rawMobile = profile.mobile || '';
          // Extract 10 digits for the input
          const digits = rawMobile.replace(/[^0-9]/g, '').slice(-10);
          setMobileNumber(digits);
        } else {
          setName(currentUser.displayName || '');
          setPhotoUrl(currentUser.photoURL || '');
        }
      } catch (e) {
        console.log('[ProfileEdit] Error loading Firestore profile:', e);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [currentUser]);

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Gallery access is needed to change photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUrl(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Pick Image Error', e.message || 'Error picking image.');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name.');
      return;
    }

    setSaving(true);
    try {
      const cleanedMobile = mobileNumber.trim().replace(/[^0-9]/g, '');
      if (cleanedMobile && cleanedMobile.length !== 10) {
        Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number.');
        setSaving(false);
        return;
      }

      const isDuplicate = await isMobileNumberRegistered(cleanedMobile, currentUser?.uid);
      if (isDuplicate) {
        Alert.alert('Error', 'Mobile number already in use by another account.');
        setSaving(false);
        return;
      }

      // Update Firebase Auth profile
      await updateUserProfile(name.trim(), photoUrl || undefined);

      // Update Firestore user document
      if (currentUser?.uid) {
        await saveUserProfileToFirestore({
          uid: currentUser.uid,
          name: name.trim(),
          email: currentUser.email || '',
          photoUrl: photoUrl || '',
          paymentHandle: paymentHandle.trim(),
          mobile: cleanedMobile ? `+91 ${cleanedMobile}` : '',
        });
      }

      Alert.alert('Success', 'Profile updated successfully.');
      navigation.goBack();
    } catch (error: any) {
      console.log('[ProfileEdit] Update Failed:', error);
      Alert.alert('Update Failed', error.message || 'Error occurred while saving changes.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <RNStatusBar barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'} />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>Edit Profile</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarCircle} onPress={handlePickImage} activeOpacity={0.8}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarCircle, { backgroundColor: colors.surfaceVariant, marginBottom: 0 }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>
                    {name
                      .trim()
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'SM'}
                  </Text>
                </View>
              )}
              <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.surfaceContainerLowest }]}>
                <MaterialIcons name="camera-alt" size={16} color={colors.onPrimary} />
              </View>
            </TouchableOpacity>
            <Text style={[styles.avatarHint, { color: colors.onSurfaceVariant, marginTop: Spacing.sm }]}>Change Profile Photo</Text>
          </View>

          <OutlinedInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rahul Sharma"
          />

          <OutlinedInput
            label="Payment Handle (UPI ID)"
            value={paymentHandle}
            onChangeText={setPaymentHandle}
            placeholder="user@okhdfcbank"
            autoCapitalize="none"
          />

          <OutlinedInput
            label="Mobile Number"
            value={mobileNumber}
            onChangeText={(val) => setMobileNumber(val.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="9876543210"
            keyboardType="number-pad"
            maxLength={10}
          />

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              saving && styles.disabledButton
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    borderWidth: 1,
  },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.lg },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { ...Typography.headlineLg },
  uploadingOverlay: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarHint: { ...Typography.labelMd },
  button: {
    width: '100%',
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadows.button,
  },
  disabledButton: { opacity: 0.7 },
  buttonText: { ...Typography.titleMd },
});
