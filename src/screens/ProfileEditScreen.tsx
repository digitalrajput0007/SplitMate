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
import { updateUserProfile } from '../services/authService';
import { getUserProfileFromFirestore, saveUserProfileToFirestore } from '../services/firestoreService';
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
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const activeUser = auth.currentUser;
    if (!activeUser?.uid) return;

    setName(activeUser.displayName || '');
    setEmail(activeUser.email || '');
    setPhotoUrl(activeUser.photoURL || '');

    getUserProfileFromFirestore(activeUser.uid)
      .then((data) => {
        if (data) {
          if (data.name) setName(data.name);
          if (data.email) setEmail(data.email);
          if (data.photoUrl) setPhotoUrl(data.photoUrl);
          if (data.mobile) setMobile(data.mobile);
          if (data.dob) setDob(data.dob);
        }
      })
      .catch((e) => console.log('Error fetching user profile:', e));
  }, []);

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setUploadingPhoto(true);
        setPhotoUrl(selectedUri);
        setUploadingPhoto(false);
      }
    } catch (error) {
      console.log('Image pick error:', error);
      Alert.alert('Error', 'Could not select photo');
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Full Name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      if (currentUser) {
        await updateUserProfile(name, photoUrl);
        await saveUserProfileToFirestore({
          uid: currentUser.uid,
          name,
          email,
          mobile,
          dob,
          photoUrl,
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
  };

  const getInitials = (userName: string) => {
    return userName
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
            <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8}>
              {uploadingPhoto ? (
                <View style={[styles.uploadingOverlay, { backgroundColor: colors.surfaceContainerHigh }]}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : photoUrl ? (
                <View style={[styles.avatarCircle, { backgroundColor: colors.primaryContainer }]}>
                  <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
                  <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.surfaceContainerLowest }]}>
                    <MaterialIcons name="photo-camera" size={14} color={colors.onPrimary} />
                  </View>
                </View>
              ) : (
                <View style={[styles.avatarCircle, { backgroundColor: colors.primaryContainer }]}>
                  <Text style={[styles.avatarText, { color: colors.onPrimaryContainer }]}>{initial}</Text>
                  <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.surfaceContainerLowest }]}>
                    <MaterialIcons name="photo-camera" size={14} color={colors.onPrimary} />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.photoActions}>
              <TouchableOpacity onPress={handlePickPhoto}>
                <Text style={[styles.avatarHint, { color: colors.primary }]}>Change Photo</Text>
              </TouchableOpacity>

              {photoUrl ? (
                <>
                  <View style={[styles.actionDivider, { backgroundColor: colors.divider }]} />
                  <TouchableOpacity onPress={handleRemovePhoto}>
                    <Text style={[styles.avatarHint, { color: colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
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
            style={[styles.button, { backgroundColor: colors.primary }, saving && styles.disabledButton]}
            onPress={handleSave}
            activeOpacity={0.85}
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
