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
import { getCurrencyConfig, CURRENCIES, CurrencyConfig, setActiveUserCurrency } from '../services/currencyService';
import { saveUserProfileToFirestore, getUserProfileFromFirestore } from '../services/firestoreService';

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', flag: '🇮🇳' },
  { code: '+1', country: 'US/CA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+49', country: 'DE', flag: '🇩🇪' },
  { code: '+61', country: 'AU', flag: '🇦🇺' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+81', country: 'JP', flag: '🇯🇵' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileSetup'>;

export default function ProfileSetupScreen({ navigation, route }: Props) {
  const currentUser = auth.currentUser;
  const initialCurrency = getCurrencyConfig();

  const [name, setName] = useState('');
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState(COUNTRY_CODES[0]);
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyConfig>(initialCurrency);
  const [paymentHandle, setPaymentHandle] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [showCcModal, setShowCcModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
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
        setSelectedCurrency(initialCurrency);
        return;
      }

      let resolvedName = route.params?.displayName || activeUser.displayName || '';
      let resolvedPhoto = route.params?.photoURL || activeUser.photoURL || '';
      let resolvedHandle = '';
      let resolvedDob = '';
      let resolvedMobile = '';
      let resolvedCurrCode = initialCurrency.code;

      try {
        const firestoreProf = await getUserProfileFromFirestore(activeUser.uid);
        if (firestoreProf) {
          if (firestoreProf.name) resolvedName = firestoreProf.name;
          if (firestoreProf.photoUrl) resolvedPhoto = firestoreProf.photoUrl;
          if (firestoreProf.paymentHandle) resolvedHandle = firestoreProf.paymentHandle;
          if (firestoreProf.dob) resolvedDob = firestoreProf.dob;
          if (firestoreProf.mobile) resolvedMobile = firestoreProf.mobile;
          if (firestoreProf.preferredCurrency) resolvedCurrCode = firestoreProf.preferredCurrency;

          if (firestoreProf.name && firestoreProf.paymentHandle && !route.params?.fromGoogle) {
            setActiveUserCurrency(resolvedCurrCode);
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

      const matchingCurr = CURRENCIES.find((c) => c.code === resolvedCurrCode) || initialCurrency;

      setName(resolvedName);
      setPhotoUrl(resolvedPhoto);
      setDobDate(resolvedDob ? new Date(resolvedDob) : null);
      if (resolvedMobile) {
        const foundCc = COUNTRY_CODES.find((c) => resolvedMobile.startsWith(c.code));
        if (foundCc) {
          setSelectedCountryCode(foundCc);
          setMobileNumber(resolvedMobile.replace(foundCc.code, '').trim());
        } else {
          setMobileNumber(resolvedMobile);
        }
      } else {
        setMobileNumber('');
      }
      setSelectedCurrency(matchingCurr);
      setPaymentHandle(
        resolvedHandle ||
          (resolvedName
            ? matchingCurr.isIndia
              ? `${resolvedName.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`
              : `${resolvedName.toLowerCase().replace(/[^a-z0-9]/g, '')}@paypal`
            : '')
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
    setSaving(true);
    const fullMobile = `${selectedCountryCode.code} ${mobileNumber.trim()}`.trim();
    const formattedDob = dobDate ? dobDate.toISOString().split('T')[0] : '';

    // Instantly set default app currency based on profile setup choice
    setActiveUserCurrency(selectedCurrency.code);

    try {
      if (name.trim()) {
        await updateUserProfile(name.trim(), photoUrl || undefined);
      }
      if (currentUser?.uid) {
        await saveUserProfileToFirestore({
          uid: currentUser.uid,
          name: name.trim() || currentUser?.displayName || 'User',
          email: currentUser?.email || '',
          photoUrl: photoUrl || currentUser?.photoURL || '',
          paymentHandle: paymentHandle.trim(),
          dob: formattedDob,
          mobile: fullMobile,
          preferredCurrency: selectedCurrency.code,
        });
      }
    } catch (err) {
      console.log('Profile saved locally (offline / non-blocking mode):', err);
    } finally {
      setSaving(false);
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
            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={styles.inputBox}>
              <TextInput
                style={styles.inputText}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (text && !paymentHandle) {
                    setPaymentHandle(
                      selectedCurrency.isIndia
                        ? `${text.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`
                        : `${text.toLowerCase().replace(/[^a-z0-9]/g, '')}@paypal`
                    );
                  }
                }}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#A0A0A0"
              />
            </View>
          </View>

          {/* Date of Birth */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Date of Birth</Text>
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
            <Text style={styles.fieldLabel}>Mobile Number</Text>
            <TouchableOpacity
              style={styles.inputBoxRow}
              onPress={() => setShowCcModal(true)}
              activeOpacity={0.85}
            >
              <TextInput
                style={[styles.inputText, { flex: 1 }]}
                value={`${selectedCountryCode.code} ${mobileNumber}`}
                onChangeText={(val) => {
                  const maxDigits = selectedCountryCode.code === '+91' ? 10 : 12;
                  const num = val.replace(selectedCountryCode.code, '').replace(/[^0-9]/g, '').slice(0, maxDigits);
                  setMobileNumber(num);
                }}
                placeholder="+91"
                placeholderTextColor="#A0A0A0"
                keyboardType="phone-pad"
                maxLength={selectedCountryCode.code.length + 13}
              />
            </TouchableOpacity>
          </View>

          {/* Preferred Currency */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Preferred Currency</Text>
            <TouchableOpacity
              style={styles.inputBoxRow}
              onPress={() => setShowCurrencyModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.inputText}>
                {selectedCurrency.code} ({selectedCurrency.symbol})
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#555555" />
            </TouchableOpacity>
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

      {/* Country Code Selection Dropdown Modal */}
      <Modal visible={showCcModal} transparent animationType="fade" onRequestClose={() => setShowCcModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCcModal(false)}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.modalHeaderTitle}>Select Country Code</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {COUNTRY_CODES.map((cc) => {
                const isSelected = cc.code === selectedCountryCode.code;
                return (
                  <TouchableOpacity
                    key={cc.code}
                    style={[styles.modalItemRow, isSelected && styles.modalItemRowSelected]}
                    onPress={() => {
                      setSelectedCountryCode(cc);
                      setShowCcModal(false);
                    }}
                  >
                    <Text style={styles.modalItemFlag}>{cc.flag}</Text>
                    <Text style={styles.modalItemText}>{cc.country} ({cc.code})</Text>
                    {isSelected && <MaterialIcons name="check" size={20} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Currency Selection Dropdown Modal */}
      <Modal visible={showCurrencyModal} transparent animationType="fade" onRequestClose={() => setShowCurrencyModal(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCurrencyModal(false)}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.modalHeaderTitle}>Select Preferred Currency</Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {CURRENCIES.map((curr) => {
                const isSelected = curr.code === selectedCurrency.code;
                return (
                  <TouchableOpacity
                    key={curr.code}
                    style={[styles.modalItemRow, isSelected && styles.modalItemRowSelected]}
                    onPress={() => {
                      setSelectedCurrency(curr);
                      setActiveUserCurrency(curr.code);
                      if (name) {
                        setPaymentHandle(
                          curr.isIndia
                            ? `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@upi`
                            : `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@paypal`
                        );
                      }
                      setShowCurrencyModal(false);
                    }}
                  >
                    <View style={styles.currencyModalLeft}>
                      <Text style={styles.modalItemTextBold}>{curr.code} ({curr.symbol})</Text>
                      <Text style={styles.modalItemSub}>{curr.name}</Text>
                    </View>
                    {isSelected && <MaterialIcons name="check" size={20} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
