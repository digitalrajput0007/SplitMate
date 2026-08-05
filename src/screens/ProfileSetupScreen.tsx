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
  Platform,
  TextInput,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import { updateUserProfile } from '../services/authService';
import {
  saveUserProfileToFirestore,
  getUserProfileFromFirestore,
  isMobileNumberRegistered,
} from '../services/firestoreService';

import { useTheme } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const currentUser = auth.currentUser;

  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [paymentHandle, setPaymentHandle] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      const activeUser = auth.currentUser;
      if (!activeUser) {
        setName('');
        setMobileNumber('');
        setPaymentHandle('');
        setPhotoUrl('');
        return;
      }

      let resolvedName = route.params?.displayName || activeUser.displayName || '';
      let resolvedPhoto = route.params?.photoURL || activeUser.photoURL || '';
      let resolvedHandle = '';
      let resolvedMobile = '';

      try {
        const firestoreProf = await getUserProfileFromFirestore(activeUser.uid);
        if (firestoreProf) {
          if (firestoreProf.name) resolvedName = firestoreProf.name;
          if (firestoreProf.photoUrl) resolvedPhoto = firestoreProf.photoUrl;
          if (firestoreProf.paymentHandle) resolvedHandle = firestoreProf.paymentHandle;
          if (firestoreProf.mobile) resolvedMobile = firestoreProf.mobile;

          if (firestoreProf.name && firestoreProf.paymentHandle && !route.params?.fromGoogle) {
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            return;
          }
        }
      } catch (e) {
        console.log('Firestore offline / cache read mode');
      }

      if (!resolvedName && activeUser.email) {
        resolvedName = activeUser.email.split('@')[0];
        resolvedName = resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1);
      }

      setName(resolvedName);
      setPhotoUrl(resolvedPhoto);
      if (resolvedMobile) {
        const digits = resolvedMobile.replace(/[^0-9]/g, '').slice(-10);
        setMobileNumber(digits);
      } else {
        setMobileNumber('');
      }
      setPaymentHandle(resolvedHandle || '');
    }

    loadInitialData();
  }, [route.params]);

  const handlePickImage = async () => {
    try {
      if (!ImagePicker || typeof ImagePicker.requestMediaLibraryPermissionsAsync !== 'function') {
        Alert.alert('Rebuild Required', 'Native image picker module is linking. Please restart the app.');
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Permission to access gallery is required to upload profile photo.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        setPhotoUrl(pickerResult.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Image Pick Error', e.message || 'Unable to select image.');
    }
  };

  const handleCompleteProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your Full Name.');
      return;
    }

    const cleanedMobile = mobileNumber.trim().replace(/[^0-9]/g, '');
    if (!cleanedMobile || cleanedMobile.length !== 10) {
      Alert.alert('Required Field', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setSaving(true);
    const fullMobile = `+91 ${cleanedMobile}`;

    try {
      const activeUser = auth.currentUser;
      const isDuplicate = await isMobileNumberRegistered(cleanedMobile, activeUser?.uid);
      if (isDuplicate) {
        setSaving(false);
        Alert.alert(
          'Mobile Number Already Registered',
          `The mobile number +91 ${cleanedMobile} is already associated with another SplitMate account. Please use a different mobile number.`
        );
        return;
      }

      await updateUserProfile(name.trim(), photoUrl || undefined);
      if (currentUser?.uid) {
        await saveUserProfileToFirestore({
          uid: currentUser.uid,
          name: name.trim(),
          email: currentUser?.email || '',
          photoUrl: photoUrl || currentUser?.photoURL || '',
          paymentHandle: paymentHandle.trim(),
          mobile: fullMobile,
        });
      }
      setSaving(false);
      navigation.navigate('ContactsPermission');
    } catch (err) {
      setSaving(false);
      console.log('Profile saved locally (offline / non-blocking mode):', err);
      navigation.navigate('ContactsPermission');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Setup Profile</Text>

        {/* Avatar Section matching initials placeholder & camera badge */}
        <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickImage} activeOpacity={0.8}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.surfaceContainerHigh }]}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarInitialsText, { color: colors.primary }]}>
                {name
                  .trim()
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'SM'}
              </Text>
            )}
          </View>
          <View style={[styles.cameraBadge, { backgroundColor: colors.primary, borderColor: colors.surfaceContainerLowest }]}>
            <MaterialIcons name="camera-alt" size={18} color={colors.onPrimary} />
          </View>
        </TouchableOpacity>

        {/* Form Container */}
        <View style={styles.formContainer}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
              Full Name <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <View style={[styles.inputBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
              <TextInput
                style={[styles.inputText, { color: colors.onSurface }]}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor={colors.outline}
              />
            </View>
          </View>

          {/* Mobile Number */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
              Mobile Number (10 digits) <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <View style={[styles.inputBoxRow, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: Spacing.sm }}>
                <Text style={{ fontSize: 16, marginRight: 4 }}>🇮🇳</Text>
                <Text style={[styles.inputText, { fontWeight: '600', color: colors.onSurface }]}>+91</Text>
              </View>
              <TextInput
                style={[styles.inputText, { flex: 1, color: colors.onSurface }]}
                value={mobileNumber}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '').slice(0, 10);
                  setMobileNumber(cleaned);
                }}
                placeholder="9876543210"
                placeholderTextColor={colors.outline}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* UPI ID (Optional) */}
          <View style={styles.fieldGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>UPI ID / Payment Handle</Text>
              <Text style={{ fontSize: 12, color: colors.onSurfaceVariant, fontWeight: '500' }}>(Optional)</Text>
            </View>
            <View style={[styles.inputBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
              <TextInput
                style={[styles.inputText, { color: colors.onSurface }]}
                value={paymentHandle}
                onChangeText={(val) => setPaymentHandle(val.replace(/\s+/g, ''))}
                placeholder="user@okhdfcbank"
                placeholderTextColor={colors.outline}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={[styles.upiInfoCard, { backgroundColor: colors.primaryFixed }]}>
              <MaterialIcons name="info-outline" size={18} color={colors.primary} />
              <Text style={[styles.upiInfoText, { color: colors.onPrimaryFixed }]}>
                Your UPI ID lets group members settle up debts directly to your Google Pay, PhonePe, or Paytm account with one tap!
              </Text>
            </View>
          </View>

          {/* Primary Continue Button matching exact blue pill in screenshot */}
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: colors.primary }, saving && styles.disabledButton]}
            onPress={handleCompleteProfile}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.continueButtonText, { color: colors.onPrimary }]}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarInitialsText: {
    fontSize: 40,
    fontWeight: '700',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 3,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 20,
  },
  fieldGroup: {
    width: '100%',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputBox: {
    width: '100%',
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputBoxRow: {
    width: '100%',
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: 15,
    fontWeight: '400',
  },
  continueButton: {
    width: '100%',
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  upiInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  upiInfoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
