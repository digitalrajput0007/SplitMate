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
  Image,
  FlatList,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Contacts from 'expo-contacts';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import {
  createGroupInFirestore,
  getAllUsersFromFirestore,
  getSavedUserContactsFromFirestore,
  UserProfile,
} from '../services/firestoreService';
import { auth } from '../config/firebase';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export type GroupTypeOption = 'Trip' | 'Family' | 'Couple' | 'Flatmate' | 'Other';

interface ContactItem {
  id: string;
  name: string;
  subText: string;
  phoneNumber?: string;
  photoUrl?: string;
  uid?: string;
  initial: string;
  avatarBg: string;
}

const GROUP_TYPES: Array<{ id: GroupTypeOption; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { id: 'Trip', label: 'Trip', icon: 'flight' },
  { id: 'Family', label: 'Family', icon: 'home' },
  { id: 'Couple', label: 'Couple', icon: 'favorite' },
  { id: 'Flatmate', label: 'Flatmate', icon: 'apartment' },
  { id: 'Other', label: 'Other', icon: 'more-horiz' },
];

const AVATAR_COLORS = [
  { bg: Colors.primaryContainer, text: Colors.onPrimaryContainer },
  { bg: Colors.surfaceContainerHighest, text: Colors.onSurface },
  { bg: Colors.secondaryContainer, text: Colors.onSecondaryContainer },
  { bg: Colors.primaryFixed, text: Colors.onPrimaryFixed },
];

export default function CreateGroupModal({ navigation }: Props) {
  const currentUser = auth.currentUser;
  const { colors, isDark } = useTheme();
  const theme = { colors, isDark };

  // Screen Flow Steps:
  // Screen 1 (Basics) -> Screen 2 (Add Members) -> Screen 3 (Confirm) -> Screen 4 (Success)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Screen 1: Group Basics State
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<GroupTypeOption>('Trip');

  // Conditional Fields
  const [startDate, setStartDate] = useState<Date>(new Date(2026, 7, 10)); // Aug 10
  const [endDate, setEndDate] = useState<Date>(new Date(2026, 7, 15));   // Aug 15
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [setupMonthlySplit, setSetupMonthlySplit] = useState(false);

  // Screen 2: Contacts & Member Selection State
  const [allContacts, setAllContacts] = useState<ContactItem[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Invite custom phone
  const [customPhone, setCustomPhone] = useState('');
  const [customName, setCustomName] = useState('');
  const [showPhoneInvite, setShowPhoneInvite] = useState(false);

  // Screen 3 & 4 State
  const [creating, setCreating] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  useEffect(() => {
    loadContactsList();
  }, []);

  const loadContactsList = async () => {
    try {
      const list: ContactItem[] = [];

      // 1. Fetch only saved user contacts from Firestore (added contacts on platform)
      if (currentUser?.uid) {
        const savedUsers = await getSavedUserContactsFromFirestore(currentUser.uid);
        savedUsers.forEach((u, idx) => {
          const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          list.push({
            id: u.uid,
            name: u.name,
            subText: u.mobile ? `+91 ${u.mobile}` : u.email,
            phoneNumber: u.mobile,
            photoUrl: u.photoUrl,
            uid: u.uid,
            initial: u.name.charAt(0).toUpperCase(),
            avatarBg: color.bg,
          });
        });
      }

      setAllContacts(list);
      setFilteredContacts(list);
      setSelectedIds(new Set());
    } catch (e) {
      console.log('Error loading contacts:', e);
    }
  };

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setGroupPhoto(result.assets[0].uri);
      }
    } catch (e) {
      console.log('Image picker error:', e);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredContacts(allContacts);
    } else {
      const lower = text.toLowerCase();
      setFilteredContacts(
        allContacts.filter(
          (c) => c.name.toLowerCase().includes(lower) || c.subText.toLowerCase().includes(lower)
        )
      );
    }
  };

  const toggleContact = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleAddCustomPhone = () => {
    const norm = customPhone.replace(/[^0-9]/g, '').slice(-10);
    if (norm.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit Indian phone number.');
      return;
    }

    const color = AVATAR_COLORS[allContacts.length % AVATAR_COLORS.length];
    const newContact: ContactItem = {
      id: `custom_${norm}`,
      name: customName.trim() || `+91 ${norm}`,
      subText: `+91 ${norm}`,
      phoneNumber: norm,
      initial: (customName.trim() || 'C').charAt(0).toUpperCase(),
      avatarBg: color.bg,
    };

    const updated = [newContact, ...allContacts];
    setAllContacts(updated);
    setFilteredContacts(updated);

    const nextSelected = new Set(selectedIds);
    nextSelected.add(newContact.id);
    setSelectedIds(nextSelected);

    setCustomPhone('');
    setCustomName('');
    setShowPhoneInvite(false);
  };

  const handleBasicsNext = () => {
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a group name before proceeding.');
      return;
    }
    setCurrentStep(2);
  };

  const handleMembersNext = () => {
    setCurrentStep(3);
  };

  const handleConfirmCreate = async () => {
    setCreating(true);
    try {
      const selectedContactsList = allContacts.filter((c) => selectedIds.has(c.id));
      const memberUids = selectedContactsList.map((c) => c.uid || c.id);

      const formattedStart = groupType === 'Trip' ? startDate.toISOString().split('T')[0] : undefined;
      const formattedEnd = groupType === 'Trip' ? endDate.toISOString().split('T')[0] : undefined;

      const newId = await createGroupInFirestore(groupName.trim(), memberUids, {
        groupType,
        photoUrl: groupPhoto || undefined,
        familyName: groupType === 'Family' && familyName.trim() ? familyName.trim() : undefined,
        setupMonthlySplit: groupType === 'Flatmate' ? setupMonthlySplit : undefined,
        enableDates: groupType === 'Trip',
        startDate: formattedStart,
        endDate: formattedEnd,
      });

      setCreatedGroupId(newId);
      setCreating(false);
      setCurrentStep(4);
    } catch (e: any) {
      setCreating(false);
      Alert.alert('Error', e.message || 'Failed to create group.');
    }
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const selectedContactsList = allContacts.filter((c) => selectedIds.has(c.id));

  // =============================================================
  // SCREEN 4: GROUP CREATED SUCCESS (Stitch ID: a0880565aed540c7863bf4d46c0f9569)
  // =============================================================
  if (currentStep === 4) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successCanvas}>
          {/* Success Icon */}
          <View style={styles.successIconCircle}>
            <MaterialIcons name="check-circle" size={64} color={Colors.primary} />
          </View>

          {/* Typography Stack */}
          <Text style={styles.successHeadline}>Group created!</Text>
          <Text style={styles.successTitle}>{groupName || 'Goa Trip'} is ready. What's next?</Text>
          <Text style={styles.successSubtitle}>Add the first expense to get started</Text>

          {/* Action Stack */}
          <View style={styles.actionStack}>
            {/* Primary Action */}
            <TouchableOpacity
              style={styles.stitchPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                navigation.replace('AddExpense', { groupId: createdGroupId || undefined });
              }}
            >
              <MaterialIcons name="add" size={20} color={Colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.stitchPrimaryBtnText}>Add Expense</Text>
            </TouchableOpacity>

            {/* Secondary Action */}
            <TouchableOpacity
              style={styles.stitchSecondaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                navigation.replace('InviteContacts');
              }}
            >
              <MaterialIcons name="person-add" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.stitchSecondaryBtnText}>Invite more people</Text>
            </TouchableOpacity>

            {/* Tertiary Action */}
            <TouchableOpacity
              style={styles.stitchTertiaryBtn}
              activeOpacity={0.7}
              onPress={() => {
                navigation.goBack();
              }}
            >
              <Text style={styles.stitchTertiaryBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // =============================================================
  // SCREEN 3: CONFIRM GROUP DETAILS (Stitch ID: ac56abc04ebd4b7b9c8010961018c8c5)
  // =============================================================
  if (currentStep === 3) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Top App Bar */}
        <View style={[styles.topAppBar, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setCurrentStep(2)}
            disabled={creating}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
          </TouchableOpacity>
          <Text style={[styles.topAppBarTitle, { color: colors.onBackground, textAlign: 'center' }]}>Confirm Group Details</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Main Content */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.confirmMainContent}>
          <View style={[styles.confirmCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            {/* Header Section */}
            <View style={styles.confirmHeader}>
              <Text style={[styles.confirmHeadlineMobile, { color: colors.onSurface }]}>Confirm Group Details</Text>
              <Text style={[styles.confirmBodyVariant, { color: colors.onSurfaceVariant }]}>
                Please review the details below before creating the group.
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.divider }]} />

            {/* Row 1: Name */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
              <View>
                <Text style={{ ...Typography.labelMd, color: colors.onSurfaceVariant, textTransform: 'uppercase' }}>GROUP NAME</Text>
                <Text style={{ ...Typography.titleMd, color: colors.onSurface, marginTop: 2 }}>{groupName || 'Group'}</Text>
              </View>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="check-circle" size={24} color={colors.primary} />
              </View>
            </View>

            {/* Row 2: Type & Dates */}
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.labelMd, color: colors.onSurfaceVariant, textTransform: 'uppercase' }}>TYPE</Text>
                <View style={{ height: 32, borderRadius: 16, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm, alignSelf: 'flex-start', marginTop: 4 }}>
                  <Text style={{ ...Typography.labelMd, color: colors.onSurface }}>{groupType.toUpperCase()}</Text>
                </View>
              </View>

              {groupType === 'Trip' && (
                <View style={{ flex: 1 }}>
                  <Text style={{ ...Typography.labelMd, color: colors.onSurfaceVariant, textTransform: 'uppercase' }}>DATES</Text>
                  <View style={{ height: 32, borderRadius: 16, backgroundColor: colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm, alignSelf: 'flex-start', marginTop: 4 }}>
                    <Text style={{ ...Typography.labelMd, color: colors.onSurface }}>
                      {formatDateShort(startDate)} - {formatDateShort(endDate)}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Row 3: Members */}
            <View style={{ marginTop: Spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: Spacing.sm }}>
                <Text style={{ ...Typography.labelMd, color: colors.onSurfaceVariant, textTransform: 'uppercase' }}>MEMBERS</Text>
                <Text style={{ ...Typography.labelMd, color: colors.primary }}>
                  {selectedContactsList.length + 1} Members
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* User avatar */}
                <View style={[styles.avatarCircle, { backgroundColor: colors.primaryContainer }]}>
                  <Text style={[styles.avatarCircleText, { color: colors.onPrimaryContainer }]}>You</Text>
                </View>
                {/* Selected members avatars */}
                {selectedContactsList.slice(0, 5).map((item) => (
                  <View key={item.id} style={[styles.avatarCircle, { backgroundColor: colors.surfaceContainerHighest }]}>
                    <Text style={[styles.avatarCircleText, { color: colors.onSurface }]}>{item.initial}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={{ width: '100%', maxWidth: 360, marginTop: Spacing.xl, flexDirection: 'row', gap: Spacing.md }}>
            <TouchableOpacity
              style={{ flex: 1, height: 48, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => setCurrentStep(1)}
              disabled={creating}
            >
              <Text style={{ ...Typography.titleMd, color: colors.primary }}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[{ flex: 1, height: 48, borderRadius: BorderRadius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, creating && styles.disabledBtn]}
              onPress={handleConfirmCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={{ ...Typography.titleMd, color: colors.onPrimary }}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // =============================================================
  // SCREEN 2: ADD MEMBERS (Stitch ID: 3451a619c98e41f9ac0523677311dd42)
  // =============================================================
  if (currentStep === 2) {
    return (
      <SafeAreaView style={styles.container}>
        {/* TopAppBar */}
        <View style={styles.topAppBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setCurrentStep(1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.topAppBarTitlePrimary} numberOfLines={1}>
            Add members to {groupName || 'Goa Trip'}
          </Text>
          <TouchableOpacity style={styles.iconBtn}>
            <MaterialIcons name="more-vert" size={24} color={Colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={{ flex: 1, paddingHorizontal: Spacing.containerMargin, paddingTop: Spacing.md }}>
          {/* Search Field */}
          <View style={styles.searchBox}>
            <MaterialIcons name="search" size={20} color={Colors.outline} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts"
              placeholderTextColor={Colors.onSurfaceVariant}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <MaterialIcons name="close" size={18} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>

          {/* Contact List Container Card */}
          <View style={styles.contactsCardContainer}>
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 0 }}
              renderItem={({ item }) => {
                const isChecked = selectedIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={styles.contactListItem}
                    onPress={() => toggleContact(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contactLeftCol}>
                      <View style={[styles.avatarCircle, { backgroundColor: item.avatarBg }]}>
                        <Text style={styles.avatarCircleText}>{item.initial}</Text>
                      </View>
                      <View style={{ marginLeft: Spacing.md }}>
                        <Text style={styles.contactItemName}>{item.name}</Text>
                        <Text style={styles.contactItemSub}>{item.subText}</Text>
                      </View>
                    </View>

                    <View style={[styles.customCheckbox, isChecked && styles.customCheckboxChecked]}>
                      {isChecked && <MaterialIcons name="check" size={14} color={Colors.onPrimary} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={
                <View>
                  {/* Integrated Invite row */}
                  <TouchableOpacity
                    style={styles.integratedInviteRow}
                    onPress={() => navigation.navigate('InviteContacts')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dottedPhoneCircle}>
                      <MaterialIcons name="person-add" size={20} color={Colors.primary} />
                    </View>
                    <Text style={styles.integratedInviteText}>Invite new members</Text>
                  </TouchableOpacity>

                  {showPhoneInvite && (
                    <View style={styles.phoneInviteCard}>
                      <Text style={styles.phoneInviteTitle}>Enter Indian Mobile Number (+91)</Text>
                      <TextInput
                        style={styles.textInputFull}
                        placeholder="Member Name (Optional)"
                        placeholderTextColor={Colors.onSurfaceVariant}
                        value={customName}
                        onChangeText={setCustomName}
                      />
                      <View style={[styles.phoneInputRow, { marginTop: 8 }]}>
                        <Text style={styles.phonePrefix}>+91</Text>
                        <TextInput
                          style={styles.phoneInputText}
                          placeholder="10-digit mobile number"
                          placeholderTextColor={Colors.onSurfaceVariant}
                          keyboardType="number-pad"
                          maxLength={10}
                          value={customPhone}
                          onChangeText={setCustomPhone}
                        />
                      </View>
                      <TouchableOpacity style={styles.addMemberSubmitBtn} onPress={handleAddCustomPhone}>
                        <Text style={styles.addMemberSubmitText}>Add Member</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              }
            />
          </View>
        </View>

        {/* Bottom Action Area with Pill Badge + Full-width Create Group Button */}
        <View style={styles.bottomActionAreaCenter}>
          <View style={styles.countPillBadge}>
            <Text style={styles.countPillText}>
              {selectedIds.size} {selectedIds.size === 1 ? 'member' : 'members'} selected
            </Text>
          </View>

          <TouchableOpacity style={styles.bottomPrimaryBtn} onPress={handleMembersNext} activeOpacity={0.85}>
            <Text style={styles.bottomPrimaryBtnText}>Create Group</Text>
            <MaterialIcons name="arrow-forward" size={20} color={Colors.onPrimary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // =============================================================
  // SCREEN 1: CREATE GROUP BASICS (Stitch ID: de45dbe388304e60bec686c33551b919)
  // =============================================================
  return (
    <SafeAreaView style={styles.container}>
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topAppBarTitle}>Create a Group</Text>
      </View>

      {/* Main Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.basicsMainContent}>
        {/* Photo Upload */}
        <View style={styles.photoUploadCenter}>
          <TouchableOpacity style={styles.photoCircleContainer} onPress={handlePickPhoto} activeOpacity={0.8}>
            {groupPhoto ? (
              <Image source={{ uri: groupPhoto }} style={styles.photoCircleImage} />
            ) : (
              <MaterialIcons name="photo-camera" size={28} color={Colors.onSurfaceVariant} />
            )}
            <View style={styles.photoAddBadge}>
              <MaterialIcons name="add" size={12} color={Colors.onPrimary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Input Field: Group Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Group name</Text>
          <TextInput
            style={styles.textInputFull}
            placeholder="e.g., Goa Trip"
            placeholderTextColor={Colors.outline}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        {/* Group Type Selection — Single Horizontal Row */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Group type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.singleRowTypeContainer}>
            {GROUP_TYPES.map((t) => {
              const isSelected = groupType === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.singleRowTypeBtn,
                    { backgroundColor: isSelected ? colors.primary : colors.surfaceContainerLowest, borderColor: isSelected ? colors.primary : colors.outlineVariant, borderWidth: isSelected ? 0 : 1 },
                  ]}
                  onPress={() => setGroupType(t.id)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={t.icon}
                    size={18}
                    color={isSelected ? colors.onPrimary : colors.onSurfaceVariant}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.singleRowTypeLabel, { color: isSelected ? colors.onPrimary : colors.onSurface }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Conditional Fields for Selected Group Type (Rendered BELOW Group Type) */}
        {groupType === 'Trip' && (
          <View style={styles.inputGroup}>
            <View style={styles.datesRow}>
              <View style={styles.dateCol}>
                <Text style={styles.inputLabel}>Start date</Text>
                <TouchableOpacity
                  style={styles.dateInputBox}
                  onPress={() => setPickerMode('start')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dateInputText}>{formatDateShort(startDate)}</Text>
                  <MaterialIcons name="calendar-today" size={16} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <View style={styles.dateCol}>
                <Text style={styles.inputLabel}>End date</Text>
                <TouchableOpacity
                  style={styles.dateInputBox}
                  onPress={() => setPickerMode('end')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dateInputText}>{formatDateShort(endDate)}</Text>
                  <MaterialIcons name="calendar-today" size={16} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            </View>

            {pickerMode && (
              <DateTimePicker
                value={pickerMode === 'start' ? startDate : endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selected) => {
                  setPickerMode(null);
                  if (selected) {
                    if (pickerMode === 'start') setStartDate(selected);
                    else setEndDate(selected);
                  }
                }}
              />
            )}
          </View>
        )}

        {groupType === 'Family' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Family name (Optional)</Text>
            <TextInput
              style={styles.textInputFull}
              placeholder="e.g., The Sharma Household"
              placeholderTextColor={Colors.outline}
              value={familyName}
              onChangeText={setFamilyName}
            />
          </View>
        )}

        {groupType === 'Flatmate' && (
          <View style={[styles.inputGroup, styles.switchCard]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Setup monthly split?</Text>
              <Text style={styles.switchSubtitle}>Automate recurring rent & utility bills</Text>
            </View>
            <Switch
              value={setupMonthlySplit}
              onValueChange={setSetupMonthlySplit}
              trackColor={{ false: Colors.surfaceContainerHighest, true: Colors.primaryContainer }}
              thumbColor={setupMonthlySplit ? Colors.primary : Colors.outline}
            />
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Area */}
      <View style={styles.bottomActionArea}>
        <TouchableOpacity style={styles.bottomPrimaryBtn} onPress={handleBasicsNext}>
          <Text style={styles.bottomPrimaryBtnText}>Next</Text>
          <MaterialIcons name="arrow-forward" size={20} color={Colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topAppBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
    backgroundColor: Colors.surface,
  },
  iconBtn: {
    padding: Spacing.sm,
    borderRadius: 20,
  },
  topAppBarTitle: {
    flex: 1,
    marginLeft: Spacing.md,
    ...Typography.titleMd,
    color: Colors.onSurface,
  },
  topAppBarTitlePrimary: {
    flex: 1,
    marginLeft: Spacing.sm,
    ...Typography.titleMd,
    color: Colors.primary,
  },
  topAppBarTitleCenter: {
    flex: 1,
    textAlign: 'center',
    ...Typography.titleMd,
    color: Colors.primary,
  },
  basicsMainContent: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 120,
  },
  photoUploadCenter: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  photoCircleContainer: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  photoCircleImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  photoAddBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  photoPickerCenter: {
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  textInputFull: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Typography.bodyLg,
  },
  singleRowTypeContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: Spacing.md,
  },
  singleRowTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    ...Shadows.card,
  },
  singleRowTypeLabel: {
    ...Typography.bodyMd,
    fontWeight: '600',
  },
  typeGridBtnSelected: {},
  typeGridBtnUnselected: {},
  typeGridTextSelected: {},
  typeGridTextUnselected: {},
  datesRow: {
    flexDirection: 'row',
    gap: Spacing.gutter,
  },
  dateCol: {
    flex: 1,
  },
  dateInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  dateInputText: {
    ...Typography.bodyMd,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  switchTitle: {
    ...Typography.titleMd,
  },
  switchSubtitle: {
    ...Typography.bodySm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyLg,
  },
  phoneInviteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  phoneInviteToggleText: {
    flex: 1,
    ...Typography.labelMd,
    fontWeight: '700',
  },
  phoneInviteCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  phoneInviteTitle: {
    ...Typography.labelMd,
    fontWeight: '700',
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
  },
  phonePrefix: {
    ...Typography.bodyLg,
    fontWeight: '700',
    marginRight: 8,
  },
  phoneInputText: {
    flex: 1,
    paddingVertical: 10,
    ...Typography.bodyLg,
  },
  addMemberSubmitBtn: {
    borderRadius: BorderRadius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  addMemberSubmitText: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  counterRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  selectedCountLabel: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  contactsCardContainer: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginTop: Spacing.md,
    overflow: 'hidden',
    ...Shadows.card,
  },
  integratedInviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  dottedPhoneCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  integratedInviteText: {
    ...Typography.titleMd,
    fontWeight: '600',
  },
  bottomActionAreaCenter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    alignItems: 'center',
  },
  countPillBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 10,
  },
  countPillText: {
    ...Typography.labelMd,
    fontWeight: '600',
  },
  contactListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  contactLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircleText: {
    ...Typography.titleMd,
    fontWeight: '600',
  },
  contactItemName: {
    ...Typography.titleMd,
  },
  contactItemSub: {
    ...Typography.bodyMd,
  },
  customCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCheckboxChecked: {},
  confirmMainContent: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    paddingHorizontal: Spacing.containerMargin,
    alignItems: 'center',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  confirmHeader: {
    alignItems: 'center',
  },
  confirmHeadlineMobile: {
    ...Typography.headlineLgMobile,
    textAlign: 'center',
  },
  confirmBodyVariant: {
    ...Typography.bodyMd,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
    width: '100%',
  },
  bottomActionArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.containerMargin,
    borderTopWidth: 1,
  },
  bottomPrimaryBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.button,
  },
  bottomPrimaryBtnText: {
    ...Typography.titleMd,
  },
  successCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.containerMargin,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  successIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  successHeadline: {
    ...Typography.headlineLgMobile,
    textAlign: 'center',
  },
  successTitle: {
    ...Typography.titleMd,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  successSubtitle: {
    ...Typography.bodyMd,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xxl,
  },
  actionStack: {
    width: '100%',
    flexDirection: 'column',
    gap: Spacing.md,
  },
  stitchPrimaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.card,
  },
  stitchPrimaryBtnText: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  stitchSecondaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  stitchSecondaryBtnText: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  stitchTertiaryBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xs,
  },
  stitchTertiaryBtnText: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
