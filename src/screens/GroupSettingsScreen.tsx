import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar as RNStatusBar,
  Platform,
  Image,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import {
  subscribeToGroupDetail,
  updateGroupInFirestore,
  deleteGroupFromFirestore,
  getGroupMembersInvitationStatus,
  GroupData,
  UserProfile,
} from '../services/firestoreService';
import { useTheme } from '../context/ThemeContext';
import { AddGroupMemberModal } from './AddGroupMemberModal';
import { GroupTypeOption } from './CreateGroupModal';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupSettings'>;

const GROUP_TYPES: Array<{ id: GroupTypeOption; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { id: 'Trip', label: 'Trip', icon: 'flight' },
  { id: 'Family', label: 'Family', icon: 'home' },
  { id: 'Couple', label: 'Couple', icon: 'favorite' },
  { id: 'Flatmate', label: 'Flatmate', icon: 'apartment' },
  { id: 'Other', label: 'Other', icon: 'more-horiz' },
];

export default function GroupSettingsScreen({ navigation, route }: Props) {
  const currentUser = auth.currentUser;
  const groupId = route.params?.groupId;
  const { colors, isDark } = useTheme();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<GroupTypeOption>('Other');
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);

  // Conditional Fields
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [setupMonthlySplit, setSetupMonthlySplit] = useState(false);

  const [acceptedUsers, setAcceptedUsers] = useState<UserProfile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  const loadMembersStatus = async (gId: string) => {
    const res = await getGroupMembersInvitationStatus(gId);
    setAcceptedUsers(res.acceptedUsers);
    setPendingUsers(res.pendingUsers);
  };

  useEffect(() => {
    if (groupId) {
      const unsub = subscribeToGroupDetail(groupId, (data) => {
        if (data) {
          setGroup(data);
          setGroupName(data.name || '');
          if (data.groupType) setGroupType(data.groupType as GroupTypeOption);
          if (data.photoUrl) setGroupPhoto(data.photoUrl);
          if (data.startDate) setStartDate(new Date(data.startDate));
          if (data.endDate) setEndDate(new Date(data.endDate));
          if (data.familyName) setFamilyName(data.familyName);
          if (data.setupMonthlySplit !== undefined) setSetupMonthlySplit(data.setupMonthlySplit);
          loadMembersStatus(groupId);
        }
      });
      return () => unsub();
    }
  }, [groupId]);

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

  const handleUpdateGroup = async () => {
    if (!groupName.trim() || !groupId) {
      Alert.alert('Validation Error', 'Group name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const formattedStart = groupType === 'Trip' ? startDate.toISOString().split('T')[0] : undefined;
      const formattedEnd = groupType === 'Trip' ? endDate.toISOString().split('T')[0] : undefined;

      await updateGroupInFirestore(groupId, {
        name: groupName.trim(),
        groupType,
        photoUrl: groupPhoto || undefined,
        familyName: groupType === 'Family' ? familyName.trim() : undefined,
        setupMonthlySplit: groupType === 'Flatmate' ? setupMonthlySplit : undefined,
        enableDates: groupType === 'Trip',
        startDate: formattedStart,
        endDate: formattedEnd,
      });
      Alert.alert('Group Updated', 'Group settings updated successfully.');
    } catch (error: any) {
      console.error('Error updating group:', error);
      Alert.alert('Error', error.message || 'Failed to update group.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;

    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? All expense records for this group will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteGroupFromFirestore(groupId);
              navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              });
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete group.');
            }
          },
        },
      ]
    );
  };

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      {/* App Header - Matching Create Group */}
      <View style={[styles.topAppBar, { paddingTop: topPadding, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.topAppBarTitle, { color: colors.onSurface }]}>Group Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Photo Upload - Identical to Create Group */}
        <View style={styles.photoUploadCenter}>
          <TouchableOpacity style={[styles.photoCircleContainer, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]} onPress={handlePickPhoto} activeOpacity={0.8}>
            {groupPhoto ? (
              <Image source={{ uri: groupPhoto }} style={styles.photoCircleImage} />
            ) : (
              <MaterialIcons name="photo-camera" size={28} color={colors.onSurfaceVariant} />
            )}
            <View style={[styles.photoAddBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
              <MaterialIcons name="edit" size={12} color={colors.onPrimary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section 1: Group Basics */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Group name</Text>
          <TextInput
            style={[styles.textInputFull, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface }]}
            placeholder="e.g., Goa Trip"
            placeholderTextColor={colors.outline}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        {/* Group Type Selector - Identical to Create Group */}
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
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceContainerLowest,
                      borderColor: isSelected ? colors.primary : colors.outlineVariant,
                      borderWidth: isSelected ? 0 : 1
                    },
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

        {/* Conditional Fields - Identical to Create Group */}
        {groupType === 'Trip' && (
          <View style={styles.inputGroup}>
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
            <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Family name (Optional)</Text>
            <TextInput
              style={[styles.textInputFull, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface }]}
              placeholder="e.g., The Sharma Household"
              placeholderTextColor={colors.outline}
              value={familyName}
              onChangeText={setFamilyName}
            />
          </View>
        )}

        {groupType === 'Flatmate' && (
          <View style={[styles.inputGroup, styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Setup monthly split?</Text>
              <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Automate recurring rent & utility bills</Text>
            </View>
            <Switch
              value={setupMonthlySplit}
              onValueChange={setSetupMonthlySplit}
              trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryContainer }}
              thumbColor={setupMonthlySplit ? colors.primary : colors.outline}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.disabledButton]}
          onPress={handleUpdateGroup}
          activeOpacity={0.85}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Update Group</Text>
          )}
        </TouchableOpacity>

        {/* Section 2: Members */}
        <View style={styles.section}>
          <View style={styles.membersHeaderRow}>
            <Text style={[styles.sectionHeaderTitle, { color: colors.onSurface }]}>Members ({acceptedUsers.length + pendingUsers.length})</Text>
            <TouchableOpacity
              style={styles.addMemberBtn}
              onPress={() => setShowAddMemberModal(true)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="person-add" size={18} color={colors.primary} />
              <Text style={[styles.addMemberText, { color: colors.primary }]}>Add Members</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.membersCardContainer, { backgroundColor: colors.surfaceContainerLowest }]}>
            {acceptedUsers.map((u, index) => {
              const isMe = u.uid === currentUser?.uid;
              const isCreator = u.uid === group?.createdBy;
              const roleLabel = isCreator ? 'Admin' : 'Member';

              return (
                <View
                  key={u.uid}
                  style={[
                    styles.memberRowItem,
                    (index !== acceptedUsers.length - 1 || pendingUsers.length > 0) && [styles.memberRowBorder, { borderBottomColor: colors.divider }],
                  ]}
                >
                  <View style={styles.memberLeftInfo}>
                    <View style={[styles.memberAvatarCircle, { backgroundColor: colors.secondaryContainer }]}>
                      {u.photoUrl ? (
                        <Image source={{ uri: u.photoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                      ) : (
                        <Text style={[styles.memberAvatarText, { color: colors.onSecondaryContainer }]}>{u.name ? u.name.charAt(0).toUpperCase() : 'M'}</Text>
                      )}
                    </View>
                    <View>
                      <Text style={[styles.memberItemName, { color: colors.onSurface }]}>{u.name} {isMe ? '(You)' : ''}</Text>
                      <Text style={[styles.memberRoleText, { color: colors.onSurfaceVariant }]}>{roleLabel} • Active</Text>
                    </View>
                  </View>

                  {!isMe && (
                    <TouchableOpacity
                      style={styles.removeIconBtn}
                      onPress={() => Alert.alert('Remove Member', `Remove ${u.name} from this group?`)}
                    >
                      <MaterialIcons name="person-remove" size={20} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {pendingUsers.map((u, index) => (
              <View
                key={u.uid}
                style={[
                  styles.memberRowItem,
                  index !== pendingUsers.length - 1 && [styles.memberRowBorder, { borderBottomColor: colors.divider }],
                  { backgroundColor: colors.surfaceContainerHighest + '44' },
                ]}
              >
                <View style={styles.memberLeftInfo}>
                  <View style={[styles.memberAvatarCircle, { backgroundColor: colors.outlineVariant }]}>
                    {u.photoUrl ? (
                      <Image source={{ uri: u.photoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    ) : (
                      <Text style={styles.memberAvatarText}>{u.name ? u.name.charAt(0).toUpperCase() : 'M'}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={[styles.memberItemName, { color: colors.onSurface }]}>{u.name}</Text>
                    <Text style={[styles.memberRoleText, { color: colors.outline, fontWeight: '600' }]}>
                      Invitation Pending ⏳
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Section 3: Danger Zone */}
        <View style={styles.dangerSection}>
          <TouchableOpacity
            style={[styles.deleteGroupBtn, { backgroundColor: isDark ? 'rgba(186, 26, 26, 0.15)' : 'rgba(186, 26, 26, 0.08)', borderColor: 'rgba(186, 26, 26, 0.2)' }]}
            onPress={handleDeleteGroup}
            activeOpacity={0.8}
          >
            <MaterialIcons name="delete-forever" size={22} color={colors.error} />
            <Text style={[styles.deleteGroupText, { color: colors.error }]}>Delete Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AddGroupMemberModal
        visible={showAddMemberModal}
        groupId={groupId}
        groupName={groupName || 'Group'}
        existingMemberIds={group?.memberIds || []}
        onClose={() => setShowAddMemberModal(false)}
        onMemberAdded={() => {}}
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
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 40,
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
  saveBtn: {
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
    ...Shadows.button,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionHeaderTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  membersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
  },
  addMemberText: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  membersCardContainer: {
    borderRadius: BorderRadius.lg,
    ...Shadows.card,
    overflow: 'hidden',
  },
  memberRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
  },
  memberLeftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  memberAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
  memberItemName: {
    ...Typography.bodyMd,
    fontWeight: '600',
  },
  memberRoleText: {
    ...Typography.labelMd,
    fontSize: 12,
  },
  removeIconBtn: {
    padding: 8,
  },
  dangerSection: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  deleteGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  deleteGroupText: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
});
