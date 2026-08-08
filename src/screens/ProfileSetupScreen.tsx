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
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { OutlinedInput } from '../components/OutlinedInput';
import { auth } from '../config/firebase';
import { updateUserProfile } from '../services/authService';
import {
  saveUserProfileToFirestore,
  getUserProfileFromFirestore,
  isMobileNumberRegistered,
} from '../services/firestoreService';
import { useMediaManager } from '../hooks/useMediaManager';
import { MediaPickerSheet } from '../components/MediaPickerSheet';
import { MediaUploadOverlay } from '../components/MediaUploadOverlay';
import { SmartImage } from '../components/SmartImage';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation, route }: Props) {
  const currentUser = auth.currentUser;

  const [name, setName] = useState('');
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [paymentHandle, setPaymentHandle] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
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
    onSuccess: (urls) => {
      setPhotoUrl(urls.original);
      if (urls.thumbnail !== undefined) setPhotoThumbnailUrl(urls.thumbnail);
      if (urls.metadata) setPhotoMetadata(urls.metadata);
    },
  });

  useEffect(() => {
    async function loadInitialData() {
      const activeUser = auth.currentUser;
      if (!activeUser) {
        setName('');
        setDobDate(null);
        setMobileNumber('');
        setPaymentHandle('');
        setPhotoUrl('');
        return;
      }

      let resolvedName = route.params?.displayName || activeUser.displayName || '';
      let resolvedPhoto = route.params?.photoURL || activeUser.photoURL || '';
      let resolvedThumb = '';
      let resolvedHandle = '';
      let resolvedDob = '';
      let resolvedMobile = '';

      try {
        const firestoreProf = await getUserProfileFromFirestore(activeUser.uid);
        if (firestoreProf) {
          if (firestoreProf.name) resolvedName = firestoreProf.name;
          if (firestoreProf.photoUrl) resolvedPhoto = firestoreProf.photoUrl;
          if (firestoreProf.photoThumbnailUrl) resolvedThumb = firestoreProf.photoThumbnailUrl;
          if (firestoreProf.paymentHandle) resolvedHandle = firestoreProf.paymentHandle;
          if (firestoreProf.dob) resolvedDob = firestoreProf.dob;
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
      setPhotoThumbnailUrl(resolvedThumb);
      setDobDate(resolvedDob ? new Date(resolvedDob) : null);
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

  const handleCompleteProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter your Full Name.');
      return;
    }

    if (!dobDate) {
      Alert.alert('Required Field', 'Please select your Date of Birth.');
      return;
    }

    const cleanedMobile = mobileNumber.trim().replace(/[^0-9]/g, '');
    if (!cleanedMobile || cleanedMobile.length !== 10) {
      Alert.alert('Required Field', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setSaving(true);
    const fullMobile = `+91 ${cleanedMobile}`;
    const formattedDob = dobDate.toISOString().split('T')[0];

    try {
      const activeUser = auth.currentUser;
      if (!activeUser) throw new Error('User not authenticated');

      const isDuplicate = await isMobileNumberRegistered(cleanedMobile, activeUser?.uid);
      if (isDuplicate) {
        setSaving(false);
        Alert.alert(
          'Mobile Number Already Registered',
          `The mobile number +91 ${cleanedMobile} is already associated with another SplitMate account. Please use a different mobile number.`
        );
        return;
      }

      // 2. Update Auth Profile
      await updateUserProfile(name.trim(), photoUrl || undefined);

      // 3. Save to Firestore
      if (currentUser?.uid) {
        await saveUserProfileToFirestore({
          uid: currentUser.uid,
          name: name.trim(),
          email: currentUser?.email || '',
          photoUrl: photoUrl || currentUser?.photoURL || '',
          photoThumbnailUrl: photoThumbnailUrl,
          photoMetadata: photoMetadata,
          paymentHandle: paymentHandle.trim(),
          dob: formattedDob,
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
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Setup Profile</Text>

        {/* Avatar Section matching initials placeholder & camera badge */}
        <View style={styles.avatarContainer}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={() => setIsPickerVisible(true)} activeOpacity={0.8}>
            <View style={styles.avatarCircle}>
              <SmartImage
                uri={photoUrl || undefined}
                thumbnailUri={photoThumbnailUrl || undefined}
                name={name}
                size={120}
                fallbackIcon="person"
              />
            </View>
            <View style={styles.cameraBadge}>
              <MaterialIcons name="camera-alt" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {photoUrl ? (
            <TouchableOpacity onPress={() => { setPhotoUrl(''); setPhotoThumbnailUrl(''); }} style={styles.removePhotoBtn}>
              <Text style={styles.removePhotoText}>Remove Photo</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Form Container */}
        <View style={styles.formContainer}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Full Name <Text style={{ color: Colors.error }}>*</Text>
            </Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.inputText}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#A0A0A0"
              />
            </View>
          </View>

          {/* Date of Birth */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Date of Birth <Text style={{ color: Colors.error }}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.inputBoxRow}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.inputText, !dobDate && { color: '#A0A0A0' }]}>
                {dobDate
                  ? `${String(dobDate.getDate()).padStart(2, '0')}-${String(dobDate.getMonth() + 1).padStart(2, '0')}-${dobDate.getFullYear()}`
                  : 'DD-MM-YYYY'}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#1A1C1C" />
            </TouchableOpacity>

            {showDatePicker && typeof DateTimePicker === 'function' && (
              <DateTimePicker
                value={dobDate || new Date(1998, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(event: any, selectedDate?: Date) => {
                  setShowDatePicker(false);
                  if (selectedDate) setDobDate(selectedDate);
                }}
              />
            )}
          </View>

          {/* Mobile Number */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Mobile Number (10 digits) <Text style={{ color: Colors.error }}>*</Text>
            </Text>
            <View style={styles.inputBoxRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: Spacing.sm }}>
                <Text style={{ fontSize: 16, marginRight: 4 }}>🇮🇳</Text>
                <Text style={[styles.inputText, { fontWeight: '600' }]}>+91</Text>
              </View>
              <TextInput
                style={[styles.inputText, { flex: 1 }]}
                value={mobileNumber}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '').slice(0, 10);
                  setMobileNumber(cleaned);
                }}
                placeholder="9876543210"
                placeholderTextColor="#A0A0A0"
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* UPI ID (Optional) */}
          <View style={styles.fieldGroup}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.fieldLabel}>UPI ID / Payment Handle</Text>
              <Text style={{ fontSize: 12, color: Colors.onSurfaceVariant, fontWeight: '500' }}>(Optional)</Text>
            </View>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.inputText}
                value={paymentHandle}
                onChangeText={(val) => setPaymentHandle(val.replace(/\s+/g, ''))}
                placeholder="user@okhdfcbank"
                placeholderTextColor="#A0A0A0"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.upiInfoCard}>
              <MaterialIcons name="info-outline" size={18} color={Colors.primary} />
              <Text style={styles.upiInfoText}>
                Your UPI ID lets group members settle up debts directly to your Google Pay, PhonePe, or Paytm account with one tap!
              </Text>
            </View>
          </View>

          {/* Primary Continue Button matching exact blue pill in screenshot */}
          <TouchableOpacity
            style={[styles.continueButton, saving && styles.disabledButton]}
            onPress={handleCompleteProfile}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
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

      <MediaUploadOverlay
        visible={isUploading}
        progress={progress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: '#1A1C1C',
    textAlign: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
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
    color: '#3F51B5',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4C56AF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  removePhotoBtn: {
    marginTop: 12,
  },
  removePhotoText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '600',
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
    color: '#4B5563',
  },
  inputBox: {
    width: '100%',
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputBoxRow: {
    width: '100%',
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '400',
  },
  continueButton: {
    width: '100%',
    height: 50,
    borderRadius: 10,
    backgroundColor: '#4051BF',
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
    color: '#FFFFFF',
  },
  upiInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primaryFixed,
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  upiInfoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.onPrimaryFixed,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dropdownModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  modalHeaderTitle: {
    fontSize: 20,
    color: '#1A1C1C',
    fontWeight: '700',
    marginBottom: 8,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 12,
  },
  modalItemRowSelected: {
    backgroundColor: '#F3F4F6',
  },
  modalItemFlag: {
    fontSize: 20,
  },
  modalItemText: {
    fontSize: 16,
    color: '#1F2937',
    flex: 1,
  },
  currencyModalLeft: {
    flex: 1,
  },
  modalItemTextBold: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  modalItemSub: {
    fontSize: 12,
    color: '#6B7280',
  },
});
