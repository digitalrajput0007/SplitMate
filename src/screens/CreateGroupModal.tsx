import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
  Image,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { createGroupInFirestore, getAllUsersFromFirestore, UserProfile } from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

interface ContactOption {
  id: string;
  name: string;
  subText: string;
  photoUrl?: string;
  isSelectable: boolean;
}

const GROUP_TYPES = [
  { id: 'Trip', label: 'Trip', icon: 'flight' },
  { id: 'Home', label: 'Home', icon: 'home' },
  { id: 'Couple', label: 'Couple', icon: 'favorite-border' },
  { id: 'Other', label: 'Other', icon: 'more-horiz' },
] as const;

const RECENT_MOCK_CONTACTS: ContactOption[] = [
  {
    id: 'rahul_101',
    name: 'Rahul Sharma',
    subText: 'rahul.s@example.com',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCS1e9KHtAYgys727oR61Z3PA-kq2nivAVMulfNx2O6lVC2j0BkAibfnJU8rTEwstfe2Ol-cgYT0VOdarijw4wSyqLN04Pnw_h9OyiVY_KpaQ3zQXWudQMgOQpvXEsVetCq3NzqII8nTp7GUG8qzw-bIU-UDBvEt2GIcm1L4jFzxBKTewjLIn6FJLZNqgmlKq0bJcSJMFSr76WFl7WNylItewYQZi-bTADelWd-OyOyeROPkosYfFwBhA',
    isSelectable: true,
  },
  {
    id: 'priya_102',
    name: 'Priya Patel',
    subText: '+91 98765 43210',
    isSelectable: true,
  },
  {
    id: 'sneha_103',
    name: 'Sneha Desai',
    subText: 'sneha.d@example.com',
    photoUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBhegNDwSuoRoPwyjkUHBB_it0WlRFsrpPwCO-UmhbvO0SdnXkqgvToG33dypGnM9INXwxUZO40MyB2JuBuuBX9rQl1JkKQixkHvpMdPe7XlI8MEOLIdh7fjMLRASL8c3r5VfUmtSIE3r43Cs-a8McezOsneQljx_k3K_r3F7V-z7-4urqDhrW0zWCupEbO41jp3EiTk5ahPSlYd7LngM04YR0i1HKV_lwCVSjRtN4WUwULFLETmsyY3w',
    isSelectable: true,
  },
];

export default function CreateGroupModal({ navigation }: Props) {
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<'Trip' | 'Home' | 'Couple' | 'Other'>('Trip');
  
  // Dates State
  const [enableDates, setEnableDates] = useState(true);
  const [startDate, setStartDate] = useState<Date>(new Date(2023, 9, 27)); // 27-10-2023
  const [endDate, setEndDate] = useState<Date>(new Date(2023, 10, 5));   // 05-11-2023
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);

  // Search & Contacts State
  const [searchQuery, setSearchQuery] = useState('');
  const [contactList, setContactList] = useState<ContactOption[]>(RECENT_MOCK_CONTACTS);
  const [filteredContacts, setFilteredContacts] = useState<ContactOption[]>(RECENT_MOCK_CONTACTS);
  const [selectedIds, setSelectedIds] = useState<string[]>(['rahul_101']);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadLiveContacts();
  }, []);

  const loadLiveContacts = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails, Contacts.Fields.Image],
        });

        const onboarded = await getAllUsersFromFirestore();

        const phonebookContacts: ContactOption[] = data
          .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
          .map((c) => ({
            id: c.id || Math.random().toString(),
            name: c.name || 'Unknown Contact',
            subText: c.phoneNumbers?.[0]?.number || c.emails?.[0]?.email || '',
            photoUrl: c.imageAvailable && c.image?.uri ? c.image.uri : undefined,
            isSelectable: true,
          }));

        // Merge onboarded users & phonebook with mock recent contacts
        const combined = [...RECENT_MOCK_CONTACTS, ...phonebookContacts];
        const unique = Array.from(new Map(combined.map((item) => [item.subText || item.name, item])).values());
        setContactList(unique);
        setFilteredContacts(unique);
      }
    } catch (e) {
      console.log('Error loading contacts in CreateGroup:', e);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredContacts(contactList);
      return;
    }
    const lower = query.toLowerCase();
    setFilteredContacts(
      contactList.filter(
        (c) => c.name.toLowerCase().includes(lower) || c.subText.toLowerCase().includes(lower)
      )
    );
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const [groupPhotoUri, setGroupPhotoUri] = useState<string | null>(null);

  const handlePickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType ? ImagePicker.MediaType.Images : (ImagePicker as any).MediaTypeOptions?.Images || 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setGroupPhotoUri(result.assets[0].uri);
      }
    } catch (e) {
      console.log('Error picking group image:', e);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter your group name (e.g. Trip to Manali).');
      return;
    }

    setCreating(true);
    const formattedStart = startDate.toISOString().split('T')[0];
    const formattedEnd = endDate.toISOString().split('T')[0];

    // Trigger Firestore creation in non-blocking manner and navigate back instantly
    createGroupInFirestore(groupName.trim(), selectedIds, {
      groupType,
      enableDates,
      startDate: formattedStart,
      endDate: formattedEnd,
    }).catch((error) => console.error('Background Group Creation Notice:', error));

    setCreating(false);
    navigation.goBack();
  };

  const formatDateString = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <SafeAreaView style={styles.container}>
      <RNStatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent />

      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#273896" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Create Group</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* NAME YOUR GROUP */}
        <Text style={styles.sectionHeaderLabel}>NAME YOUR GROUP</Text>
        <View style={styles.nameGroupRow}>
          <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickPhoto} activeOpacity={0.8}>
            {groupPhotoUri ? (
              <Image source={{ uri: groupPhotoUri }} style={styles.groupPhotoImg} />
            ) : (
              <>
                <MaterialIcons name="add-a-photo" size={22} color="#757684" />
                <Text style={styles.addPhotoLabel}>ADD</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.nameInputBox}>
            <MaterialIcons name="person-add-alt" size={20} color="#757684" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.nameTextInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="e.g., Trip to Manali"
              placeholderTextColor="#A0A0A0"
            />
          </View>
        </View>

        {/* CHOOSE GROUP TYPE */}
        <Text style={styles.sectionHeaderLabel}>CHOOSE GROUP TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupTypeScroll}>
          {GROUP_TYPES.map((t) => {
            const isSelected = groupType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.groupTypePill, isSelected ? styles.groupTypePillSelected : styles.groupTypePillUnselected]}
                onPress={() => setGroupType(t.id)}
                activeOpacity={0.8}
              >
                <MaterialIcons name={t.icon} size={18} color={isSelected ? '#273896' : '#454652'} />
                <Text style={[styles.groupTypePillText, { color: isSelected ? '#273896' : '#454652' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ENABLE DATES CARD */}
        <View style={styles.datesCard}>
          <View style={styles.datesCardHeader}>
            <View>
              <Text style={styles.datesCardTitle}>Enable dates</Text>
              <Text style={styles.datesCardSub}>Track expenses for a specific period</Text>
            </View>
            <Switch
              value={enableDates}
              onValueChange={setEnableDates}
              trackColor={{ false: '#D1D5DB', true: '#273896' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {enableDates && (
            <View style={styles.datesRow}>
              {/* Start Date */}
              <View style={styles.dateFieldFlex}>
                <Text style={styles.dateFieldLabel}>START DATE</Text>
                <TouchableOpacity
                  style={styles.datePickerInput}
                  onPress={() => setPickerMode('start')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dateInputText}>{formatDateString(startDate)}</Text>
                  <MaterialIcons name="calendar-today" size={18} color="#1A1C1C" />
                </TouchableOpacity>
              </View>

              {/* End Date */}
              <View style={styles.dateFieldFlex}>
                <Text style={styles.dateFieldLabel}>END DATE</Text>
                <TouchableOpacity
                  style={styles.datePickerInput}
                  onPress={() => setPickerMode('end')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dateInputText}>{formatDateString(endDate)}</Text>
                  <MaterialIcons name="calendar-today" size={18} color="#1A1C1C" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {pickerMode && typeof DateTimePicker === 'function' && (
            <DateTimePicker
              value={pickerMode === 'start' ? startDate : endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event: any, selectedDate?: Date) => {
                const currentMode = pickerMode;
                setPickerMode(null);
                if (selectedDate) {
                  if (currentMode === 'start') setStartDate(selectedDate);
                  else setEndDate(selectedDate);
                }
              }}
            />
          )}
        </View>

        {/* INVITE FRIENDS HEADER */}
        <View style={styles.inviteHeaderRow}>
          <Text style={styles.sectionHeaderLabel}>INVITE FRIENDS</Text>
          <Text style={styles.selectedCountText}>{selectedIds.length} Selected</Text>
        </View>

        {/* SEARCH BAR */}
        <View style={styles.searchBoxContainer}>
          <MaterialIcons name="search" size={22} color="#757684" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInputText}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Name, email, or phone number"
            placeholderTextColor="#A0A0A0"
          />
        </View>

        {/* RECENT CONTACTS CARD LIST */}
        <View style={styles.recentContactsCard}>
          <Text style={styles.recentCardHeader}>RECENT CONTACTS</Text>
          {filteredContacts.map((c, index) => {
            const isSelected = selectedIds.includes(c.id);
            const avatarLetter = c.name.charAt(0).toUpperCase();

            return (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.contactRowItem,
                  index !== filteredContacts.length - 1 && styles.contactRowBorder,
                ]}
                onPress={() => toggleSelect(c.id)}
                activeOpacity={0.8}
              >
                <View style={styles.contactLeftInfo}>
                  <View style={styles.contactAvatarCircle}>
                    {c.photoUrl ? (
                      <Image source={{ uri: c.photoUrl }} style={styles.contactAvatarImg} />
                    ) : (
                      <Text style={styles.contactAvatarLetter}>{avatarLetter}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={styles.contactItemName}>{c.name}</Text>
                    <Text style={styles.contactItemSub}>{c.subText}</Text>
                  </View>
                </View>

                <MaterialIcons
                  name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
                  size={24}
                  color={isSelected ? '#273896' : '#C5C5D4'}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* CREATE GROUP BOTTOM BUTTON */}
      <View style={styles.bottomBarContainer}>
        <TouchableOpacity
          style={[styles.createGroupBtn, creating && styles.disabledBtn]}
          onPress={handleCreateGroup}
          activeOpacity={0.85}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.btnContentRow}>
              <MaterialIcons name="check" size={20} color="#FFFFFF" />
              <Text style={styles.createGroupBtnText}>Create Group</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#273896',
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  sectionHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 10,
  },
  nameGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addPhotoBtn: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  addPhotoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  nameInputBox: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameTextInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  groupTypeScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 4,
  },
  groupTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  groupTypePillSelected: {
    backgroundColor: '#E0E0FF',
    borderColor: '#273896',
  },
  groupTypePillUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  groupTypePillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  datesCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  datesCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datesCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  datesCardSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  datesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateFieldFlex: {
    flex: 1,
    gap: 4,
  },
  dateFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  datePickerInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateInputText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  inviteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  selectedCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#273896',
  },
  searchBoxContainer: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInputText: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  recentContactsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  recentCardHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    letterSpacing: 0.5,
  },
  contactRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  contactRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactLeftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#959EFD',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  contactAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  contactAvatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  contactItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  contactItemSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  createGroupBtn: {
    height: 50,
    borderRadius: 10,
    backgroundColor: '#273896',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createGroupBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
