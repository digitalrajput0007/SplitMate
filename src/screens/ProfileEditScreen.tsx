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
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { OutlinedInput } from '../components/OutlinedInput';
import { auth } from '../config/firebase';
import { updateUserProfile } from '../services/authService';
import { getUserProfileFromFirestore, saveUserProfileToFirestore } from '../services/firestoreService';
import { useMediaManager } from '../hooks/useMediaManager';
import { MediaPickerSheet } from '../components/MediaPickerSheet';
import { SmartImage } from '../components/SmartImage';
import { useTheme } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

export default function ProfileEditScreen({ navigation }: Props) {
  const currentUser = auth.currentUser;
  const { colors, isDark } = useTheme();

  const [name, setName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('15-08-1995');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photoURL || '');
  const [photoThumbnailUrl, setPhotoThumbnailUrl] = useState('');
  const [photoMetadata, setPhotoMetadata] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const {
    isUploading,
    progress,
    isPickerVisible,
    setIsPickerVisible,
    takePhoto,
    pickFromGallery,
    browseFiles,
    removeMedia,
  } = useMediaManager({
    purpose: 'profile',
    id: currentUser?.uid || 'temp',
    previousUrls: { original: photoUrl, thumbnail: photoThumbnailUrl },
    onSuccess: (urls) => {
      setPhotoUrl(urls.original);
      if (urls.thumbnail !== undefined) setPhotoThumbnailUrl(urls.thumbnail);
      if (urls.metadata) setPhotoMetadata(urls.metadata);
    },
  });

  useEffect(() => {
    const activeUser = auth.currentUser;
    if (!activeUser?.uid) return;

    setName(activeUser.displayName || '');
    setEmail(activeUser.email || '');
    // Only set from auth if we don't have a more recent URL in memory
    if (!photoUrl) setPhotoUrl(activeUser.photoURL || '');

    getUserProfileFromFirestore(activeUser.uid)
      .then((data) => {
        if (data) {
          if (data.name !== undefined) setName(data.name);
          if (data.email !== undefined) setEmail(data.email);
          if (data.photoUrl !== undefined) setPhotoUrl(data.photoUrl);
          if (data.photoThumbnailUrl !== undefined) setPhotoThumbnailUrl(data.photoThumbnailUrl);
          if (data.mobile !== undefined) setMobile(data.mobile);
          if (data.dob !== undefined) setDob(data.dob);
        }
      })
      .catch((e) => console.log('Error fetching user profile:', e));
  }, []);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Validation Error', 'Full Name cannot be empty');
      return;
    }

    if (!/^[A-Za-z]+(?:\s[A-Za-z]+)*$/.test(trimmedName)) {
      Alert.alert(
        'Invalid Name',
        'Name can only contain letters and spaces. Numbers, dots, and special characters are not allowed.'
      );
      return;
    }

    setSaving(true);
    try {
      if (currentUser) {
        // Update Auth and Firestore
        await updateUserProfile(name, photoUrl);
        await saveUserProfileToFirestore({
          uid: currentUser.uid,
          name,
          email,
          mobile,
          dob,
          photoUrl,
          photoThumbnailUrl,
          photoMetadata,
        });

        Alert.alert('Success', 'Profile updated successfully');
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
    setPhotoThumbnailUrl('');
  };

  const getInitials = (userName: string) => {
    return (userName || '')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  const initial = getInitials(name);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Edit Profile</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity 
              onPress={() => setIsPickerVisible(true)} 
              activeOpacity={0.8} 
              style={{ position: 'relative' }}
              disabled={isUploading}
            >
              <View style={{ borderRadius: 40, overflow: 'hidden', opacity: isUploading ? 0.7 : 1 }}>
                <SmartImage
                  uri={photoUrl}
                  thumbnailUri={photoThumbnailUrl}
                  name={name}
                  size={80}
                  fallbackIcon="person"
                />
                {isUploading && (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 40, alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginTop: 2 }}>{Math.round(progress)}%</Text>
                  </View>
                )}
              </View>
              <View style={[styles.cameraBadge, { backgroundColor: isUploading ? colors.outline : colors.primary, borderColor: colors.surfaceContainerLowest }]}>
                <MaterialIcons name="photo-camera" size={14} color={colors.onPrimary} />
              </View>
            </TouchableOpacity>

            {photoUrl ? (
              <TouchableOpacity onPress={handleRemovePhoto} style={{ marginTop: 8 }} disabled={isUploading}>
                <Text style={[styles.avatarHint, { color: isUploading ? colors.outline : colors.error }]}>Remove Photo</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Form Fields */}
          <OutlinedInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
          />
          <OutlinedInput
            label="Email Address"
            value={email}
            editable={false}
          />
          <OutlinedInput
            label="Mobile Number"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
            placeholder="+91 9876543210"
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, (saving || isUploading) && styles.disabledButton]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving || isUploading}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
                {isUploading ? 'Uploading Image...' : 'Save Changes'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <MediaPickerSheet
        visible={isPickerVisible}
        onDismiss={() => setIsPickerVisible(false)}
        onCamera={takePhoto}
        onGallery={pickFromGallery}
        onFiles={browseFiles}
        onRemove={photoUrl ? removeMedia : undefined}
      />
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
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: Spacing.sm,
  },
  actionDivider: {
    width: 1,
    height: 12,
  },
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
