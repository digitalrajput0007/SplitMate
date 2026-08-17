import React, { useState, useEffect, useCallback } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Contacts from 'expo-contacts';
import { RootStackParamList } from '../navigation/types';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import {
  createGroupInFirestore,
  getSavedUserContactsFromFirestore,
  Contact,
  UserProfile,
} from '../services/firestoreService';
import { auth } from '../config/firebase';
import { useMediaManager } from '../hooks/useMediaManager';
import { MediaPickerSheet } from '../components/MediaPickerSheet';
import { SmartImage } from '../components/SmartImage';

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

export default function CreateGroupModal({ navigation }: Props) {
  const currentUser = auth.currentUser;
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const AVATAR_COLORS = React.useMemo(() => [
    { bg: colors.primaryContainer, text: colors.onPrimaryContainer },
    { bg: colors.surfaceContainerHighest, text: colors.onSurface },
    { bg: colors.secondaryContainer, text: colors.onSecondaryContainer },
    { bg: colors.primaryFixed, text: colors.onPrimaryFixed },
  ], [colors]);

  // Screen Flow Steps:
  // Screen 1 (Basics) -> Screen 2 (Add Members) -> Screen 3 (Confirm) -> Screen 4 (Success)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Screen 1: Group Basics State
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [groupPhotoThumb, setGroupPhotoThumb] = useState<string | null>(null);
  const [groupPhotoMetadata, setGroupPhotoMetadata] = useState<any>(null);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<GroupTypeOption>('Trip');

  const {
    isUploading,
    progress,
    isPickerVisible,
    setIsPickerVisible,
    takePhoto,
    pickFromGallery,
    browseFiles,
  } = useMediaManager({
    purpose: 'group',
    id: `temp_${Date.now()}`,
    onSuccess: (urls) => {
      setGroupPhoto(urls.original);
      if (urls.thumbnail) setGroupPhotoThumb(urls.thumbnail);
      if (urls.metadata) setGroupPhotoMetadata(urls.metadata);
    },
  });

  // Conditional Fields
  const [enableTripDates, setEnableTripDates] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [setupMonthlySplit, setSetupMonthlySplit] = useState(false);
  const [enableFamilyReminder, setEnableFamilyReminder] = useState(false);
  const [familyReminderDate, setFamilyReminderDate] = useState<Date>(new Date());
  const [showFamilyReminderPicker, setShowFamilyReminderPicker] = useState(false);
  const [enableBalanceAlert, setEnableBalanceAlert] = useState(false);
  const [balanceAlertThreshold, setBalanceAlertThreshold] = useState('2000');
  const [enableFlatmateSettleReminder, setEnableFlatmateSettleReminder] = useState(false);
  const [flatmateReminderDate, setFlatmateReminderDate] = useState<Date>(new Date());
  const [showFlatmateReminderPicker, setShowFlatmateReminderPicker] = useState(false);

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

  const loadContactsList = useCallback(async () => {
    try {
      const list: ContactItem[] = [];

      if (currentUser?.uid) {
        const savedContacts = await getSavedUserContactsFromFirestore(currentUser.uid);
        savedContacts.forEach((u, idx) => {
          const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          list.push({
            id: u.phone,
            name: u.name,
            subText: u.phone,
            phoneNumber: u.phone,
            photoUrl: u.photoUrl,
            uid: u.uid,
            initial: u.name.charAt(0).toUpperCase(),
            avatarBg: color.bg,
          });
        });
      }

      setAllContacts(list);
      setFilteredContacts(list);
    } catch (e) {
      console.log('Error loading contacts:', e);
    }
  }, [currentUser?.uid, AVATAR_COLORS]);

  useFocusEffect(
    useCallback(() => {
      loadContactsList();
    }, [loadContactsList])
  );

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

      const hasTripDates = groupType === 'Trip' && enableTripDates;
      const formattedStart = hasTripDates ? startDate.toISOString().split('T')[0] : undefined;
      const formattedEnd = hasTripDates ? endDate.toISOString().split('T')[0] : undefined;
      const hasFamilyReminder = groupType === 'Family' && enableFamilyReminder;
      const formattedReminder = hasFamilyReminder ? familyReminderDate.toISOString().split('T')[0] : undefined;
      const hasCoupleBalanceAlert = groupType === 'Couple' && enableBalanceAlert;
      const alertThresholdNum = hasCoupleBalanceAlert ? parseFloat(balanceAlertThreshold) || 2000 : undefined;
      const hasFlatmateReminder = groupType === 'Flatmate' && enableFlatmateSettleReminder;
      const formattedFlatmateReminder = hasFlatmateReminder ? flatmateReminderDate.toISOString().split('T')[0] : undefined;

      const newId = await createGroupInFirestore(groupName.trim(), memberUids, {
        groupType,
        photoUrl: groupPhoto || undefined,
        photoThumbnailUrl: groupPhotoThumb || undefined,
        photoMetadata: groupPhotoMetadata || undefined,
        familyName: groupType === 'Family' && familyName.trim() ? familyName.trim() : undefined,
        enableDates: hasTripDates,
        startDate: formattedStart,
        endDate: formattedEnd,
        enableSettleReminder: hasFamilyReminder,
        settleReminderDate: formattedReminder,
        enableBalanceAlert: hasCoupleBalanceAlert,
        balanceAlertThreshold: alertThresholdNum,
        enableFlatmateSettleReminder: hasFlatmateReminder,
        flatmateReminderDate: formattedFlatmateReminder,
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

  // Screen 4: GROUP CREATED SUCCESS (Stitch ID: a0880565aed540c7863bf4d46c0f9569)
  // =============================================================
  if (currentStep === 4) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.successCanvas}>
          {/* Success Icon */}
          <View style={[styles.successIconCircle, { backgroundColor: colors.surfaceContainerLowest }]}>
            <MaterialIcons name="check-circle" size={64} color={colors.primary} />
          </View>

          {/* Typography Stack */}
          <Text style={[styles.successHeadline, { color: colors.onBackground }]}>Group created!</Text>
          <Text style={[styles.successTitle, { color: colors.onSurface }]}>{groupName || 'Goa Trip'} is ready. What's next?</Text>
          <Text style={[styles.successSubtitle, { color: colors.onSurfaceVariant }]}>Add the first expense to get started</Text>

          {/* Action Stack */}
          <View style={styles.actionStack}>
            {/* Primary Action */}
            <TouchableOpacity
              style={[styles.stitchPrimaryBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={() => {
                navigation.replace('AddExpense', { groupId: createdGroupId || undefined });
              }}
            >
              <MaterialIcons name="add" size={20} color={colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={[styles.stitchPrimaryBtnText, { color: colors.onPrimary }]}>Add Expense</Text>
            </TouchableOpacity>

            {/* Secondary Action */}
            <TouchableOpacity
              style={[styles.stitchSecondaryBtn, { borderColor: colors.primary }]}
              activeOpacity={0.85}
              onPress={() => {
                navigation.replace('MainTabs', { screen: 'ContactsTab' });
              }}
            >
              <MaterialIcons name="contacts" size={20} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.stitchSecondaryBtnText, { color: colors.primary }]}>View Contacts</Text>
            </TouchableOpacity>

            {/* Tertiary Action */}
            <TouchableOpacity
              style={styles.stitchTertiaryBtn}
              activeOpacity={0.7}
              onPress={() => {
                navigation.goBack();
              }}
            >
              <Text style={[styles.stitchTertiaryBtnText, { color: colors.primary }]}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>

        <MediaPickerSheet
          visible={isPickerVisible}
          onDismiss={() => setIsPickerVisible(false)}
          onCamera={takePhoto}
          onGallery={pickFromGallery}
          onFiles={browseFiles}
        />
      </SafeAreaView>
    );
  }

  // =============================================================
  // SCREEN 3: CONFIRM GROUP DETAILS (Stitch ID: ac56abc04ebd4b7b9c8010961018c8c5)
  // =============================================================
  if (currentStep === 3) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top App Bar */}
        <View style={[styles.topAppBar, { backgroundColor: colors.surface }]}>
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

            {/* Row 1: Name & Avatar */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.md }}>
              <SmartImage
                uri={groupPhoto || undefined}
                thumbnailUri={groupPhotoThumb || undefined}
                name={groupName}
                size={44}
                fallbackIcon={GROUP_TYPES.find(t => t.id === groupType)?.icon || 'groups'}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.labelMd, color: colors.onSurfaceVariant, textTransform: 'uppercase' }}>GROUP NAME</Text>
                <Text style={{ ...Typography.titleMd, color: colors.onSurface, marginTop: 2 }}>{groupName || 'Group'}</Text>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="check" size={20} color="#FFFFFF" />
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
                  {currentUser?.photoURL ? (
                    <Image source={{ uri: currentUser.photoURL }} style={styles.avatarImg} />
                  ) : (
                    <Text style={[styles.avatarCircleText, { color: colors.onPrimaryContainer }]}>You</Text>
                  )}
                </View>
                {/* Selected members avatars */}
                {selectedContactsList.slice(0, 5).map((item) => (
                  <View key={item.id} style={[styles.avatarCircle, { backgroundColor: colors.surfaceContainerHighest }]}>
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={styles.avatarImg} />
                    ) : (
                      <Text style={[styles.avatarCircleText, { color: colors.onSurface }]}>{item.initial}</Text>
                    )}
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* TopAppBar */}
        <View style={[styles.topAppBar, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setCurrentStep(1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={[styles.topAppBarTitlePrimary, { color: colors.primary }]} numberOfLines={1}>
            Add members to {groupName || 'Goa Trip'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Main Content */}
        <View style={{ flex: 1, paddingHorizontal: Spacing.containerMargin, paddingTop: Spacing.md, paddingBottom: 130 + Math.max(insets.bottom, 16) }}>
          {/* Search Field */}
          <View style={[styles.searchBox, { borderColor: colors.outline, backgroundColor: colors.surfaceContainerLow }]}>
            <MaterialIcons name="search" size={20} color={colors.outline} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Search contacts"
              placeholderTextColor={colors.onSurfaceVariant}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery !== '' && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            )}
          </View>

          {/* Contact List Container Card */}
          <View style={[styles.contactsCardContainer, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 0 }}
              renderItem={({ item }) => {
                const isChecked = selectedIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.contactListItem, { borderBottomColor: colors.outlineVariant }]}
                    onPress={() => toggleContact(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contactLeftCol}>
                      <View style={[styles.avatarCircle, { backgroundColor: item.avatarBg }]}>
                        {item.photoUrl ? (
                          <Image source={{ uri: item.photoUrl }} style={styles.avatarImg} />
                        ) : (
                          <Text style={[styles.avatarCircleText, { color: colors.onPrimaryContainer }]}>{item.initial}</Text>
                        )}
                      </View>
                      <View style={{ marginLeft: Spacing.md }}>
                        <Text style={[styles.contactItemName, { color: colors.onSurface }]}>{item.name}</Text>
                        <Text style={[styles.contactItemSub, { color: colors.onSurfaceVariant }]}>{item.subText}</Text>
                      </View>
                    </View>

                    <View style={[
                      styles.customCheckbox,
                      { borderColor: colors.primary },
                      isChecked && [styles.customCheckboxChecked, { backgroundColor: colors.primary }]
                    ]}>
                      {isChecked && <MaterialIcons name="check" size={14} color={colors.onPrimary} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListFooterComponent={
                <View>
                  {/* Integrated Invite row */}
                  <TouchableOpacity
                    style={styles.integratedInviteRow}
                    onPress={() => navigation.navigate('MainTabs', { screen: 'ContactsTab' })}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.dottedPhoneCircle, { borderColor: colors.primary }]}>
                      <MaterialIcons name="person-add" size={20} color={colors.primary} />
                    </View>
                    <Text style={[styles.integratedInviteText, { color: colors.onSurface }]}>Add or Sync Contacts</Text>
                  </TouchableOpacity>

                  {showPhoneInvite && (
                    <View style={[styles.phoneInviteCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow }]}>
                      <Text style={[styles.phoneInviteTitle, { color: colors.onSurface }]}>Enter Indian Mobile Number (+91)</Text>
                      <TextInput
                        style={[styles.textInputFull, { borderColor: colors.outlineVariant, color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest }]}
                        placeholder="Member Name (Optional)"
                        placeholderTextColor={colors.onSurfaceVariant}
                        value={customName}
                        onChangeText={setCustomName}
                      />
                      <View style={[styles.phoneInputRow, { marginTop: 8, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
                        <Text style={[styles.phonePrefix, { color: colors.onSurface }]}>+91</Text>
                        <TextInput
                          style={[styles.phoneInputText, { color: colors.onSurface }]}
                          placeholder="10-digit mobile number"
                          placeholderTextColor={colors.onSurfaceVariant}
                          keyboardType="number-pad"
                          maxLength={10}
                          value={customPhone}
                          onChangeText={setCustomPhone}
                        />
                      </View>
                      <TouchableOpacity style={[styles.addMemberSubmitBtn, { backgroundColor: colors.primary }]} onPress={handleAddCustomPhone}>
                        <Text style={[styles.addMemberSubmitText, { color: colors.onPrimary }]}>Add Member</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              }
            />
          </View>
        </View>

        {/* Bottom Action Area with Pill Badge + Full-width Create Group Button */}
        <View style={[styles.bottomActionAreaCenter, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 16) + Spacing.sm }]}>
          <View style={[styles.countPillBadge, { backgroundColor: colors.primaryFixed }]}>
            <Text style={[styles.countPillText, { color: colors.onPrimaryFixed }]}>
              {selectedIds.size} {selectedIds.size === 1 ? 'member' : 'members'} selected
            </Text>
          </View>

          <TouchableOpacity style={[styles.bottomPrimaryBtn, { backgroundColor: colors.primary }]} onPress={handleMembersNext} activeOpacity={0.85}>
            <Text style={[styles.bottomPrimaryBtnText, { color: colors.onPrimary }]}>Create Group</Text>
            <MaterialIcons name="arrow-forward" size={20} color={colors.onPrimary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // =============================================================
  // SCREEN 1: CREATE GROUP BASICS (Stitch ID: de45dbe388304e60bec686c33551b919)
  // =============================================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* TopAppBar */}
      <View style={[styles.topAppBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.topAppBarTitle, { color: colors.onSurface }]}>Create a Group</Text>
      </View>

      {/* Main Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.basicsMainContent, { paddingBottom: 120 + Math.max(insets.bottom, 16) }]}>
        {/* Photo Upload */}
        <View style={styles.photoUploadCenter}>
          <TouchableOpacity
            style={[styles.photoCircleContainer, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}
            onPress={() => setIsPickerVisible(true)}
            activeOpacity={0.8}
            disabled={isUploading}
          >
            <View style={{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden', opacity: isUploading ? 0.7 : 1 }}>
              <SmartImage
                uri={groupPhoto || undefined}
                thumbnailUri={groupPhotoThumb || undefined}
                name={groupName}
                size={80}
                fallbackIcon={GROUP_TYPES.find(t => t.id === groupType)?.icon || 'groups'}
              />
              {isUploading && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 40, alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginTop: 2 }}>{Math.round(progress)}%</Text>
                </View>
              )}
            </View>
            <View style={[styles.photoAddBadge, { backgroundColor: isUploading ? colors.outline : colors.primary, borderColor: colors.surface }]}>
              <MaterialIcons name="add" size={12} color={colors.onPrimary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Input Field: Group Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Group name</Text>
          <TextInput
            style={[styles.textInputFull, { borderColor: colors.outlineVariant, color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest }]}
            placeholder="e.g., Goa Trip"
            placeholderTextColor={colors.outline}
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
            <View style={[styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, marginBottom: enableTripDates ? 12 : 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Add trip dates?</Text>
                <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Set start and end dates for your trip</Text>
              </View>
              <Switch
                value={enableTripDates}
                onValueChange={setEnableTripDates}
                trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {enableTripDates && (
              <View style={styles.datesRow}>
                <View style={styles.dateCol}>
                  <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Start date</Text>
                  <TouchableOpacity
                    style={[styles.dateInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}
                    onPress={() => setPickerMode('start')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dateInputText, { color: colors.onSurface }]}>{formatDateShort(startDate)}</Text>
                    <MaterialIcons name="calendar-today" size={16} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                <View style={styles.dateCol}>
                  <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>End date</Text>
                  <TouchableOpacity
                    style={[styles.dateInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}
                    onPress={() => setPickerMode('end')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.dateInputText, { color: colors.onSurface }]}>{formatDateShort(endDate)}</Text>
                    <MaterialIcons name="calendar-today" size={16} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {enableTripDates && pickerMode && (
              <DateTimePicker
                value={pickerMode === 'start' ? startDate : endDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') {
                    setPickerMode(null);
                  }

                  if (selected && event.type !== 'dismissed') {
                    if (pickerMode === 'start') {
                      setStartDate(selected);
                      if (selected > endDate) {
                        setEndDate(selected);
                      }
                    } else {
                      if (selected < startDate) {
                        setEndDate(startDate);
                      } else {
                        setEndDate(selected);
                      }
                    }
                  }

                  if (Platform.OS === 'ios') {
                    setPickerMode(null);
                  }
                }}
              />
            )}
          </View>
        )}

        {groupType === 'Family' && (
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Family name (Optional)</Text>
            <TextInput
              style={[styles.textInputFull, { borderColor: colors.outlineVariant, color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest, marginBottom: 12 }]}
              placeholder="e.g., The Sharma Household"
              placeholderTextColor={colors.outline}
              value={familyName}
              onChangeText={setFamilyName}
            />

            <View style={[styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, marginBottom: enableFamilyReminder ? 12 : 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Enable Settle Up Reminder?</Text>
                <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Send reminder notification to all family members on a date</Text>
              </View>
              <Switch
                value={enableFamilyReminder}
                onValueChange={setEnableFamilyReminder}
                trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {enableFamilyReminder && (
              <View style={styles.dateCol}>
                <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Reminder date</Text>
                <TouchableOpacity
                  style={[styles.dateInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}
                  onPress={() => setShowFamilyReminderPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateInputText, { color: colors.onSurface }]}>{formatDateShort(familyReminderDate)}</Text>
                  <MaterialIcons name="notifications-active" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {enableFamilyReminder && showFamilyReminderPicker && (
              <DateTimePicker
                value={familyReminderDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') setShowFamilyReminderPicker(false);
                  if (selected && event.type !== 'dismissed') {
                    setFamilyReminderDate(selected);
                  }
                  if (Platform.OS === 'ios') setShowFamilyReminderPicker(false);
                }}
              />
            )}
          </View>
        )}

        {groupType === 'Couple' && (
          <View style={styles.inputGroup}>
            <View style={[styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, marginBottom: enableBalanceAlert ? 12 : 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Set balance alert?</Text>
                <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Alert the group when someone's balance reaches a set amount</Text>
              </View>
              <Switch
                value={enableBalanceAlert}
                onValueChange={setEnableBalanceAlert}
                trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {enableBalanceAlert && (
              <View style={{ gap: 6 }}>
                <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Alert threshold amount (₹)</Text>
                <TextInput
                  style={[styles.textInputFull, { borderColor: colors.outlineVariant, color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest }]}
                  placeholder="e.g., 2000"
                  placeholderTextColor={colors.outline}
                  keyboardType="numeric"
                  value={balanceAlertThreshold}
                  onChangeText={setBalanceAlertThreshold}
                />
              </View>
            )}
          </View>
        )}

        {groupType === 'Flatmate' && (
          <View style={styles.inputGroup}>
            <View style={[styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, marginBottom: enableFlatmateSettleReminder ? 12 : 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Remind to settle up?</Text>
                <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Trigger monthly notification to members who owe balance</Text>
              </View>
              <Switch
                value={enableFlatmateSettleReminder}
                onValueChange={setEnableFlatmateSettleReminder}
                trackColor={{ false: colors.outlineVariant, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {enableFlatmateSettleReminder && (
              <View style={styles.dateCol}>
                <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Reminder date</Text>
                <TouchableOpacity
                  style={[styles.dateInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}
                  onPress={() => setShowFlatmateReminderPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateInputText, { color: colors.onSurface }]}>{formatDateShort(flatmateReminderDate)}</Text>
                  <MaterialIcons name="notifications-active" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            )}

            {enableFlatmateSettleReminder && showFlatmateReminderPicker && (
              <DateTimePicker
                value={flatmateReminderDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') setShowFlatmateReminderPicker(false);
                  if (selected && event.type !== 'dismissed') {
                    setFlatmateReminderDate(selected);
                  }
                  if (Platform.OS === 'ios') setShowFlatmateReminderPicker(false);
                }}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Area */}
      <View style={[styles.bottomActionArea, { backgroundColor: colors.background, borderTopColor: colors.divider, paddingBottom: Math.max(insets.bottom, 16) + Spacing.sm }]}>
        <TouchableOpacity 
          style={[styles.bottomPrimaryBtn, { backgroundColor: colors.primary, opacity: isUploading ? 0.6 : 1 }]} 
          onPress={handleBasicsNext}
          disabled={isUploading}
        >
          <Text style={[styles.bottomPrimaryBtnText, { color: colors.onPrimary }]}>
            {isUploading ? 'Uploading Image...' : 'Next'}
          </Text>
          {!isUploading && <MaterialIcons name="arrow-forward" size={20} color={colors.onPrimary} />}
        </TouchableOpacity>
      </View>

      <MediaPickerSheet
        visible={isPickerVisible}
        onDismiss={() => setIsPickerVisible(false)}
        onCamera={takePhoto}
        onGallery={pickFromGallery}
        onFiles={browseFiles}
        onRemove={groupPhoto ? () => { setGroupPhoto(null); setGroupPhotoThumb(null); } : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topAppBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMargin,
  },
  iconBtn: {
    padding: Spacing.sm,
    borderRadius: 20,
  },
  topAppBarTitle: {
    flex: 1,
    marginLeft: Spacing.md,
    ...Typography.titleMd,
  },
  topAppBarTitlePrimary: {
    flex: 1,
    marginLeft: Spacing.sm,
    ...Typography.titleMd,
  },
  topAppBarTitleCenter: {
    flex: 1,
    textAlign: 'center',
    ...Typography.titleMd,
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
    borderWidth: 1,
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
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.labelMd,
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
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
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
