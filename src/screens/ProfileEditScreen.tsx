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
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { OutlinedInput } from '../components/OutlinedInput';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../config/firebase';
import { updateUserProfile } from '../services/authService';
import { getUserProfileFromFirestore, saveUserProfileToFirestore } from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

export default function ProfileEditScreen({ navigation }: Props) {
  const currentUser = auth.currentUser;

  const [name, setName] = useState(currentUser?.displayName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [mobile, setMobile] = useState('');
  const [dob, setDob] = useState('15-08-1995');
  const [photoUrl, setPhotoUrl] = useState(currentUser?.photoURL || '');
  const [initialPhotoUrl, setInitialPhotoUrl] = useState(currentUser?.photoURL || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const activeUser = auth.currentUser;
    if (!activeUser?.uid) return;

    setName(activeUser.displayName || '');
    setEmail(activeUser.email || '');
    setPhotoUrl(activeUser.photoURL || '');
    setInitialPhotoUrl(activeUser.photoURL || '');

    getUserProfileFromFirestore(activeUser.uid)
      .then((data) => {
        if (data) {
          if (data.name) setName(data.name);
          if (data.email) setEmail(data.email);
          if (data.photoUrl) {
            setPhotoUrl(data.photoUrl);
            setInitialPhotoUrl(data.photoUrl);
          }
          if (data.mobile) setMobile(data.mobile);
          if (data.dob) setDob(data.dob);
        }
      })
      .catch((err) => {
        console.error('Error fetching profile:', err);
      });
  }, [auth.currentUser?.uid]);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUri = result.assets[0].uri;
        setUploadingPhoto(true);
        // Simulate image processing/upload delay
        setTimeout(() => {
          setPhotoUrl(newUri);
          setUploadingPhoto(false);
        }, 800);
      }
    } catch (e: any) {
      setUploadingPhoto(false);
      Alert.alert('Couldn\'t save settings, please try again');
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your display name.');
      return;
    }

    setSaving(true);
    try {
      // Don't re-upload / re-update photo if unchanged
      const finalPhotoUrl = photoUrl === initialPhotoUrl ? initialPhotoUrl : photoUrl;

      await updateUserProfile(name.trim(), finalPhotoUrl.trim() || undefined);

      if (currentUser?.uid) {
        await saveUserProfileToFirestore({
          uid: currentUser.uid,
          name: name.trim(),
          email: email.trim() || currentUser.email || '',
          photoUrl: finalPhotoUrl.trim(),
          mobile: mobile,
          dob: dob,
        });
      }

      Alert.alert('Profile Updated', 'Your personal information has been saved successfully.');
      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Couldn\'t save settings, please try again');
    } finally {
      setSaving(false);
    }
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';

  return (
    <SafeAreaView style={styles.container}>
      <RNStatusBar backgroundColor={Colors.background} barStyle="dark-content" translucent />
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Personal Information</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <TouchableOpacity style={styles.avatarSection} onPress={handlePickImage} activeOpacity={0.8} disabled={uploadingPhoto}>
            <View style={styles.avatarCircle}>
              {uploadingPhoto ? (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                </View>
              ) : photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
              <View style={styles.cameraBadge}>
                <MaterialIcons name="edit" size={14} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.avatarHint}>
              {uploadingPhoto ? 'Uploading photo...' : 'Tap edit icon to change profile photo'}
            </Text>
          </TouchableOpacity>

          <OutlinedInput
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Sachin Rajput"
          />

          <OutlinedInput
            label="Email Address"
            value={email || currentUser?.email || ''}
            placeholder="user@example.com"
            editable={false}
          />

          <OutlinedInput
            label="Date of Birth"
            value={dob || '15-08-1995'}
            placeholder="DD-MM-YYYY"
            editable={false}
          />

          <OutlinedInput
            label="Mobile Number"
            value={mobile || '+91 9876543210'}
            placeholder="+91 9876543210"
            editable={false}
          />

          <TouchableOpacity
            style={[styles.button, saving && styles.disabledButton]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
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
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.lg },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { ...Typography.headlineLg, color: Colors.onPrimaryContainer },
  uploadingOverlay: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceContainerHigh,
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarHint: { ...Typography.labelMd, color: Colors.onSurfaceVariant },
  button: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadows.button,
  },
  disabledButton: { opacity: 0.7 },
  buttonText: { ...Typography.titleMd, color: Colors.onPrimary },
});
