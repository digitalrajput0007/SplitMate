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
  StatusBar,
  Modal as RNModal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import {
  createGroupInFirestore,
  getSavedUserContactsFromFirestore,
} from '../services/firestoreService';
import { auth } from '../config/firebase';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export type GroupTypeOption = 'Trip' | 'Home' | 'Couple' | 'Family' | 'Flatmate' | 'Other';

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
  { id: 'Home', label: 'Home', icon: 'home' },
  { id: 'Couple', label: 'Couple', icon: 'favorite' },
  { id: 'Family', label: 'Family', icon: 'groups' },
  { id: 'Flatmate', label: 'Flatmate', icon: 'apartment' },
  { id: 'Other', label: 'Other', icon: 'more-horiz' },
];

export default function CreateGroupModal({ navigation }: Props) {
  const currentUser = auth.currentUser;
  const { colors, isDark } = useTheme();

  const AVATAR_COLORS = [
    { bg: colors.primaryContainer, text: colors.onPrimaryContainer },
    { bg: colors.surfaceContainerHighest, text: colors.onSurface },
    { bg: colors.secondaryContainer, text: colors.onSecondaryContainer },
    { bg: colors.primaryFixed, text: colors.onPrimaryFixed },
  ];

  const [creating, setCreating] = useState(false);
  const [showMemberPicker, setShowPhoneInvite] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  // Form State
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<GroupTypeOption>('Trip');

  // Conditional Fields
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000));
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [setupMonthlySplit, setSetupMonthlySplit] = useState(false);

  // Members State
  const [allContacts, setAllContacts] = useState<ContactItem[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadContactsList();
  }, []);

  const loadContactsList = async () => {
    try {
      const list: ContactItem[] = [];
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
      setFilteredContacts(allContacts.filter((c) => c.name.toLowerCase().includes(lower) || c.subText.toLowerCase().includes(lower)));
    }
  };

  const toggleContact = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required', 'Please enter a group name.');
      return;
    }

    setCreating(true);
    try {
      const selectedContactsList = allContacts.filter((c) => selectedIds.has(c.id));
      const memberUids = selectedContactsList.map((c) => c.uid || c.id);

      const formattedStart = groupType === 'Trip' ? startDate.toISOString().split('T')[0] : undefined;
      const formattedEnd = groupType === 'Trip' ? endDate.toISOString().split('T')[0] : undefined;

      const newId = await createGroupInFirestore(groupName.trim(), memberUids, {
        groupType: groupType === 'Home' ? 'Other' : groupType as any, // Map 'Home' to 'Other' if Firestore doesn't support it
        photoUrl: groupPhoto || undefined,
        familyName: groupType === 'Family' && familyName.trim() ? familyName.trim() : undefined,
        setupMonthlySplit: groupType === 'Flatmate' ? setupMonthlySplit : undefined,
        enableDates: groupType === 'Trip',
        startDate: formattedStart,
        endDate: formattedEnd,
      });

      setCreatedGroupId(newId);
      setSuccess(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create group.');
    } finally {
      setCreating(false);
    }
  };

  const selectedContactsList = allContacts.filter((c) => selectedIds.has(c.id));

  // Success View
  if (success) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.successCanvas}>
          <View style={[styles.successIconCircle, { backgroundColor: colors.surfaceContainerLowest }]}>
            <MaterialIcons name="check-circle" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.successHeadline, { color: colors.onSurface }]}>Group created!</Text>
          <Text style={[styles.successTitle, { color: colors.onSurface }]}>{groupName} is ready.</Text>
          <View style={styles.actionStack}>
            <TouchableOpacity
              style={[styles.stitchPrimaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => navigation.replace('AddExpense', { groupId: createdGroupId || undefined })}
            >
              <MaterialIcons name="add" size={20} color={colors.onPrimary} style={{ marginRight: 8 }} />
              <Text style={[styles.stitchPrimaryBtnText, { color: colors.onPrimary }]}>Add Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stitchTertiaryBtn} onPress={() => navigation.goBack()}>
              <Text style={[styles.stitchTertiaryBtnText, { color: colors.onSurfaceVariant }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Create Group</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Photo Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.photoCenter} onPress={handlePickPhoto} activeOpacity={0.8}>
            <View style={[styles.photoCircle, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
              {groupPhoto ? (
                <Image source={{ uri: groupPhoto }} style={styles.photoImg} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={[styles.photoInitial, { color: colors.primary }]}>
                    {groupName.trim() ? groupName.charAt(0).toUpperCase() : <MaterialIcons name="photo-camera" size={32} />}
                  </Text>
                </View>
              )}
              <View style={[styles.photoBadge, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                <MaterialIcons name="add" size={14} color={colors.onPrimary} />
              </View>
            </View>
            <Text style={[styles.photoLabel, { color: colors.onSurfaceVariant }]}>Group Photo (Optional)</Text>
          </TouchableOpacity>
        </View>

        {/* Group Name */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Group Name *</Text>
          <TextInput
            style={[styles.input, { color: colors.onSurface, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}
            placeholder="e.g. Goa Trip, Apartment 402"
            placeholderTextColor={colors.outline}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        {/* Group Type */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Group Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {GROUP_TYPES.map((t) => {
              const selected = groupType === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.typeChip,
                    { backgroundColor: selected ? colors.primary : colors.surfaceContainerLowest, borderColor: selected ? colors.primary : colors.outlineVariant }
                  ]}
                  onPress={() => setGroupType(t.id)}
                >
                  <MaterialIcons name={t.icon} size={18} color={selected ? colors.onPrimary : colors.onSurfaceVariant} style={{ marginRight: 6 }} />
                  <Text style={[styles.typeChipLabel, { color: selected ? colors.onPrimary : colors.onSurface }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Conditional Fields */}
        {groupType === 'Trip' && (
          <View style={styles.section}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Start Date</Text>
                <TouchableOpacity style={[styles.dateBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]} onPress={() => setPickerMode('start')}>
                  <Text style={{ color: colors.onSurface }}>{startDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>End Date</Text>
                <TouchableOpacity style={[styles.dateBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]} onPress={() => setPickerMode('end')}>
                  <Text style={{ color: colors.onSurface }}>{endDate.toLocaleDateString()}</Text>
                </TouchableOpacity>
              </View>
            </View>
            {pickerMode && (
              <DateTimePicker
                value={pickerMode === 'start' ? startDate : endDate}
                onChange={(e, d) => { setPickerMode(null); if (d) pickerMode === 'start' ? setStartDate(d) : setEndDate(d); }}
              />
            )}
          </View>
        )}

        {/* Members Section */}
        <View style={styles.section}>
          <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Members</Text>
            <TouchableOpacity style={styles.addMemberBtn} onPress={() => setShowPhoneInvite(true)}>
              <MaterialIcons name="person-add" size={20} color={colors.primary} />
              <Text style={[styles.addMemberText, { color: colors.primary }]}>Add Members</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.subLabel, { color: colors.onSurfaceVariant, marginTop: 12 }]}>Selected Members</Text>
          <View style={styles.memberList}>
            {/* You (Admin) */}
            <View style={[styles.memberItem, { borderBottomColor: colors.divider }]}>
              <View style={[styles.memberAvatar, { backgroundColor: colors.primaryFixed }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>U</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.memberName, { color: colors.onSurface }]}>You (Admin)</Text>
                <Text style={[styles.memberSub, { color: colors.onSurfaceVariant }]}>{currentUser?.email || currentUser?.phoneNumber}</Text>
              </View>
              <MaterialIcons name="check-circle" size={20} color={colors.primary} />
            </View>

            {/* Others */}
            {selectedContactsList.map((item) => (
              <View key={item.id} style={[styles.memberItem, { borderBottomColor: colors.divider }]}>
                <View style={[styles.memberAvatar, { backgroundColor: item.avatarBg }]}>
                  <Text style={[styles.avatarText, { color: colors.onSurface }]}>{item.initial}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.memberName, { color: colors.onSurface }]}>{item.name}</Text>
                  <Text style={[styles.memberSub, { color: colors.onSurfaceVariant }]}>{item.subText}</Text>
                </View>
                <TouchableOpacity onPress={() => toggleContact(item.id)}>
                  <MaterialIcons name="remove-circle-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer Button */}
      <View style={[styles.footer, { borderTopColor: colors.divider }]}>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }, creating && { opacity: 0.7 }]}
          onPress={handleCreateGroup}
          disabled={creating}
        >
          {creating ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.createBtnText, { color: colors.onPrimary }]}>Create Group</Text>}
        </TouchableOpacity>
      </View>

      {/* Member Picker Modal Overlay */}
      <RNModal visible={showMemberPicker} animationType="slide" onRequestClose={() => setShowPhoneInvite(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setShowPhoneInvite(false)}>
              <MaterialIcons name="close" size={24} color={colors.onSurface} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.onSurface }]}>Select Members</Text>
            <View style={{ width: 48 }} />
          </View>
          <View style={styles.searchSection}>
            <View style={[styles.searchBar, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
              <MaterialIcons name="search" size={20} color={colors.outline} />
              <TextInput
                style={[styles.searchInput, { color: colors.onSurface }]}
                placeholder="Search contacts"
                placeholderTextColor={colors.outline}
                value={searchQuery}
                onChangeText={handleSearch}
              />
            </View>
          </View>
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const selected = selectedIds.has(item.id);
              return (
                <TouchableOpacity style={[styles.memberItem, { borderBottomColor: colors.divider, paddingHorizontal: 24 }]} onPress={() => toggleContact(item.id)}>
                  <View style={[styles.memberAvatar, { backgroundColor: item.avatarBg }]}>
                    <Text style={[styles.avatarText, { color: colors.onSurface }]}>{item.initial}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.memberName, { color: colors.onSurface }]}>{item.name}</Text>
                    <Text style={[styles.memberSub, { color: colors.onSurfaceVariant }]}>{item.subText}</Text>
                  </View>
                  <MaterialIcons name={selected ? "check-box" : "check-box-outline-blank"} size={24} color={selected ? colors.primary : colors.outline} />
                </TouchableOpacity>
              );
            }}
          />
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={() => setShowPhoneInvite(false)}>
              <Text style={[styles.createBtnText, { color: colors.onPrimary }]}>Done ({selectedIds.size})</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </RNModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, borderBottomWidth: 1 },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.titleLg, fontWeight: '600' },
  scroll: { paddingBottom: 40 },
  section: { paddingHorizontal: 24, marginTop: 24 },
  photoCenter: { alignItems: 'center' },
  photoCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoInitial: { ...Typography.displayLg, fontSize: 32 },
  photoBadge: { position: 'absolute', bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  photoLabel: { ...Typography.labelMd, marginTop: 12 },
  label: { ...Typography.labelLg, fontWeight: '700', marginBottom: 8 },
  subLabel: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 1 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, ...Typography.bodyLg },
  typeRow: { paddingRight: 24 },
  typeChip: { flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  typeChipLabel: { ...Typography.labelLg },
  row: { flexDirection: 'row' },
  dateBox: { height: 52, borderRadius: 12, borderWidth: 1, justifyContent: 'center', paddingHorizontal: 16 },
  addMemberBtn: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  addMemberText: { ...Typography.labelLg, marginLeft: 6, fontWeight: '600' },
  memberList: { marginTop: 8 },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...Typography.titleMd, fontWeight: '700' },
  memberName: { ...Typography.titleMd },
  memberSub: { ...Typography.bodySm },
  footer: { padding: 24, borderTopWidth: 1 },
  createBtn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', ...Shadows.button },
  createBtnText: { ...Typography.titleMd, fontWeight: '700' },
  successCanvas: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successIconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24, ...Shadows.card },
  successHeadline: { ...Typography.headlineLg, textAlign: 'center' },
  successTitle: { ...Typography.titleLg, textAlign: 'center', marginTop: 8, marginBottom: 40 },
  actionStack: { width: '100%', gap: 16 },
  stitchPrimaryBtn: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', ...Shadows.card },
  stitchPrimaryBtnText: { ...Typography.titleMd, fontWeight: '700' },
  stitchTertiaryBtn: { height: 54, alignItems: 'center', justifyContent: 'center' },
  stitchTertiaryBtnText: { ...Typography.labelLg, fontWeight: '700' },
  searchSection: { padding: 16 },
  searchBar: { height: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  searchInput: { flex: 1, marginLeft: 8, ...Typography.bodyLg },
});
