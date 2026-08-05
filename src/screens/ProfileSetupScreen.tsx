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
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { OutlinedInput } from '../components/OutlinedInput';
import { auth } from '../config/firebase';
import { updateUserProfile } from '../services/authService';
import {
  saveUserProfileToFirestore,
  getUserProfileFromFirestore,
  isMobileNumberRegistered,
} from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation, route }: Props) {
  const currentUser = auth.currentUser;

  const [name, setName] = useState('');
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [paymentHandle, setPaymentHandle] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

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
      let resolvedHandle = '';
      let resolvedDob = '';
      let resolvedMobile = '';

      try {
        const firestoreProf = await getUserProfileFromFirestore(activeUser.uid);
        if (firestoreProf) {
          if (firestoreProf.name) resolvedName = firestoreProf.name;
          if (firestoreProf.photoUrl) resolvedPhoto = firestoreProf.photoUrl;
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
      setDobDate(resolvedDob ? new Date(resolvedDob) : null);
      if (resolvedMobile) {
        const digits = resolvedMobile.replace(/[^0-9]/g, '').slice(-10);
        setMobileNumber(digits);
      } else {
        setMobileNumber('');
      }
      setPaymentHandle(
        resolvedHandle ||
          (resolvedName ? `${resolvedName.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi` : '')
      );
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
        mediaTypes: ImagePicker.MediaType ? ImagePicker.MediaType.Images : (ImagePicker as any).MediaTypeOptions?.Images || 'images',
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
          paymentHandle: paymentHandle.trim() || `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`,
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
        <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickImage} activeOpacity={0.8}>
          <View style={styles.avatarCircle}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitialsText}>
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
          <View style={styles.cameraBadge}>
            <MaterialIcons name="camera-alt" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

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
                onChangeText={(text) => {
                  setName(text);
                  if (text && !paymentHandle) {
                    setPaymentHandle(`${text.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`);
                  }
                }}
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
