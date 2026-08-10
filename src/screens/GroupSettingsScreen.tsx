import React, { useState, useEffect, useRef } from 'react';
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
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { auth, db } from '../config/firebase';
import {
  subscribeToGroupDetail,
  updateGroupInFirestore,
  deleteGroupFromFirestore,
  cancelGroupInvitation,
  leaveGroupInFirestore,
  transferGroupOwnership,
  toggleGroupArchive,
  subscribeToGroupExpenses,
  subscribeToGroupSettlements,
  getGroupMembersInvitationStatus,
  GroupData,
  UserProfile,
  ExpenseData,
  SettlementData,
  formatCurrency,
  subscribeToAcceptedMembers,
  reinviteUserToGroupInFirestore,
  removeMemberFromGroup,
  addSettlementToFirestore,
} from '../services/firestoreService';
import { useMediaManager } from '../hooks/useMediaManager';
import { MediaPickerSheet } from '../components/MediaPickerSheet';
import { SmartImage } from '../components/SmartImage';
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
  const [groupPhotoThumbnail, setGroupPhotoThumbnail] = useState<string | null>(null);
  const [groupPhotoMetadata, setGroupPhotoMetadata] = useState<any>(null);

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
    purpose: 'group',
    id: groupId || 'temp',
    previousUrls: { original: groupPhoto || undefined, thumbnail: groupPhotoThumbnail || undefined },
    onSuccess: (urls) => {
      setGroupPhoto(urls.original);
      if (urls.thumbnail !== undefined) setGroupPhotoThumbnail(urls.thumbnail);
      if (urls.metadata) setGroupPhotoMetadata(urls.metadata);
    },
  });

  const handleRemovePhoto = async () => {
    await removeMedia();
  };

  // Conditional Fields
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [setupMonthlySplit, setSetupMonthlySplit] = useState(false);

  const [acceptedUsers, setAcceptedUsers] = useState<UserProfile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [declinedUsers, setDeclinedUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [userExpenses, setUserExpenses] = useState<ExpenseData[]>([]);
  const [userSettlements, setUserSettlements] = useState<SettlementData[]>([]);
  const isDeletingRef = useRef(false);

  const isOwner = group?.createdBy === currentUser?.uid;

  useEffect(() => {
    if (groupId) {
      const unsubGroup = subscribeToGroupDetail(groupId, (data) => {
        if (data) {
          setGroup(data);
          setGroupName(data.name || '');
          if (data.groupType) setGroupType(data.groupType as GroupTypeOption);
          if (data.photoUrl !== undefined) setGroupPhoto(data.photoUrl);
          if (data.photoThumbnailUrl !== undefined) setGroupPhotoThumbnail(data.photoThumbnailUrl);
          if (data.startDate) setStartDate(new Date(data.startDate));
          if (data.endDate) setEndDate(new Date(data.endDate));
          if (data.familyName) setFamilyName(data.familyName);
          if (data.setupMonthlySplit !== undefined) setSetupMonthlySplit(data.setupMonthlySplit);
        } else if (!isDeletingRef.current) {
          Alert.alert(
            'Group Deleted',
            'The group owner has deleted this group.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.navigate('MainTabs', { screen: 'Groups' } as any);
                },
              },
            ]
          );
        }
      });

      const unsubMembers = subscribeToAcceptedMembers(groupId, (accepted, pending, declined) => {
        setAcceptedUsers(accepted);
        setPendingUsers(pending);
        setDeclinedUsers(declined);
      });

      const unsubExp = subscribeToGroupExpenses(groupId, (expList) => {
        setUserExpenses(expList);
      });

      const unsubSet = subscribeToGroupSettlements(groupId, (setList) => {
        setUserSettlements(setList);
      });

      return () => {
        unsubGroup();
        unsubMembers();
        unsubExp();
        unsubSet();
      };
    }
  }, [groupId]);

  const calculateUserBalance = () => {
    let balance = 0;
    const uid = currentUser?.uid;
    if (!uid) return 0;

    // 1. Calculate from expenses
    userExpenses.forEach((item) => {
      const amt = item.amount || 0;
      const splits = item.splitDetails || {};
      if (item.paidBy === uid) {
        // I paid: I am owed the amount minus my own share
        const myShare = splits[uid] || 0;
        balance += (amt - myShare);
      } else if (splits[uid]) {
        // Someone else paid: I owe my share
        balance -= splits[uid];
      }
    });

    // 2. Factor in completed settlements
    userSettlements.forEach((s) => {
      if (s.status === 'completed' || !s.status) {
        if (s.fromUserId === uid) {
          // I paid off a debt: my negative balance increases (moves toward zero)
          balance += s.amount;
        } else if (s.toUserId === uid) {
          // Someone paid me: my positive balance decreases (moves toward zero)
          balance -= s.amount;
        }
      }
    });

    return Math.round(balance * 100) / 100;
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

      const updateData: any = {
        name: groupName.trim(),
        groupType,
        photoUrl: groupPhoto || '',
        photoThumbnailUrl: groupPhotoThumbnail || '',
        photoMetadata: groupPhotoMetadata,
        enableDates: groupType === 'Trip',
      };

      if (groupType === 'Family') updateData.familyName = familyName.trim();
      if (groupType === 'Flatmate') updateData.setupMonthlySplit = setupMonthlySplit;
      if (groupType === 'Trip') {
        updateData.startDate = formattedStart;
        updateData.endDate = formattedEnd;
      }

      await updateGroupInFirestore(groupId, updateData);
      Alert.alert('Group Updated', 'Group settings updated successfully.');
    } catch (error: any) {
      console.error('Error updating group:', error);
      Alert.alert('Error', error.message || 'Failed to update group.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransferOwnership = (u: UserProfile) => {
    if (!groupId) return;

    Alert.alert(
      'Transfer Ownership',
      `Are you sure you want to make ${u.name} the owner of this group? You will lose administrative privileges.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            try {
              await transferGroupOwnership(groupId, u.uid);
              Alert.alert('Success', `${u.name} is now the group owner.`);
            } catch (e) {
              Alert.alert('Error', 'Failed to transfer ownership.');
            }
          },
        },
      ]
    );
  };

  const handleReinviteMember = async (u: UserProfile) => {
    if (!groupId) return;
    try {
      await reinviteUserToGroupInFirestore(groupId, u.uid);
      Alert.alert('Re-invited', `A new invitation request has been sent to ${u.name}.`);
    } catch (error: any) {
      console.error('Re-invite error details:', error);
      Alert.alert('Error', error?.message || 'Failed to re-invite member.');
    }
  };

  const calculateMemberBalance = (targetUid: string) => {
    let paid = 0;
    let share = 0;

    userExpenses.forEach((item) => {
      if (item.paidBy === targetUid) {
        paid += (item.amount || 0);
      }
      share += (item.splitDetails?.[targetUid] || 0);
    });

    let received = 0;
    let sent = 0;

    userSettlements.forEach((s) => {
      if (s.status === 'completed' || !s.status) {
        if (s.toUserId === targetUid) received += (s.amount || 0);
        if (s.fromUserId === targetUid) sent += (s.amount || 0);
      }
    });

    return Math.round((paid - share + sent - received) * 100) / 100;
  };

  const handleRemoveMemberClick = (u: UserProfile) => {
    if (!groupId) return;
    const balance = calculateMemberBalance(u.uid);

    if (Math.abs(balance) < 0.05) {
      Alert.alert(
        'Remove Member',
        `Remove ${u.name} from this group? They will no longer see group expenses.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await removeMemberFromGroup(groupId, u.uid);
                Alert.alert('Removed', `${u.name} has been removed from the group.`);
              } catch (err) {
                Alert.alert('Error', 'Failed to remove member.');
              }
            },
          },
        ]
      );
      return;
    }

    const isOwed = balance > 0;
    const absVal = Math.abs(balance);
    const formattedVal = formatCurrency(absVal);
    const statusText = isOwed ? `is owed ${formattedVal}` : `owes ${formattedVal}`;

    Alert.alert(
      'Unsettled Balance Warning ⚠️',
      `${u.name} ${statusText} in this group.\n\nChoose how to handle this balance before removing them:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Settled',
          onPress: async () => {
            try {
              if (isOwed) {
                await addSettlementToFirestore({
                  groupId,
                  fromUserId: currentUser?.uid || '',
                  toUserId: u.uid,
                  amount: absVal,
                  notes: `Auto-settled upon removing ${u.name}`,
                  status: 'completed',
                });
              } else {
                await addSettlementToFirestore({
                  groupId,
                  fromUserId: u.uid,
                  toUserId: currentUser?.uid || '',
                  amount: absVal,
                  notes: `Auto-settled upon removing ${u.name}`,
                  status: 'completed',
                });
              }
              await removeMemberFromGroup(groupId, u.uid);
              Alert.alert('Success', `Settled ${formattedVal} and removed ${u.name}.`);
            } catch (e) {
              Alert.alert('Error', 'Failed to settle and remove member.');
            }
          },
        },
        {
          text: 'Redistribute Balance',
          onPress: async () => {
            try {
              const remainingMembers = acceptedUsers.filter(x => x.uid !== u.uid);
              if (remainingMembers.length === 0) {
                Alert.alert('Error', 'No remaining members to redistribute balance to.');
                return;
              }
              const perPersonShare = Math.round((absVal / remainingMembers.length) * 100) / 100;

              for (const rem of remainingMembers) {
                if (isOwed) {
                  await addSettlementToFirestore({
                    groupId,
                    fromUserId: rem.uid,
                    toUserId: u.uid,
                    amount: perPersonShare,
                    notes: `Balance redistributed upon removing ${u.name}`,
                    status: 'completed',
                  });
                } else {
                  await addSettlementToFirestore({
                    groupId,
                    fromUserId: u.uid,
                    toUserId: rem.uid,
                    amount: perPersonShare,
                    notes: `Balance redistributed upon removing ${u.name}`,
                    status: 'completed',
                  });
                }
              }

              await removeMemberFromGroup(groupId, u.uid);
              Alert.alert('Success', `Redistributed ${formattedVal} among remaining members and removed ${u.name}.`);
            } catch (e) {
              Alert.alert('Error', 'Failed to redistribute balance and remove member.');
            }
          },
        },
      ]
    );
  };

  const handleToggleArchive = async () => {
    if (!groupId) return;
    const isCurrentlyArchived = group?.isArchived || false;

    Alert.alert(
      isCurrentlyArchived ? 'Restore Group' : 'Archive Group',
      isCurrentlyArchived
        ? 'Do you want to restore this group to your active list?'
        : 'Archiving hides the group from your main list but keeps all records. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isCurrentlyArchived ? 'Restore' : 'Archive',
          onPress: async () => {
            try {
              await toggleGroupArchive(groupId, !isCurrentlyArchived);
              Alert.alert('Success', isCurrentlyArchived ? 'Group restored.' : 'Group archived.');
              if (!isCurrentlyArchived) {
                navigation.goBack();
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to update archive status.');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = async () => {
    if (!groupId || !currentUser?.uid) return;

    if (isOwner) {
      Alert.alert('Cannot Leave', 'As the owner, you must delete the group or transfer ownership before leaving.');
      return;
    }

    const currentBalance = calculateUserBalance();
    if (Math.abs(currentBalance) > 0.05) {
      Alert.alert(
        'Outstanding Balance',
        `You cannot leave the group until your balance is zero. Your current balance: ${formatCurrency(currentBalance)}.`
      );
      return;
    }

    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group? You will no longer be able to see expenses or contribute.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroupInFirestore(groupId, currentUser.uid);
              navigation.navigate('MainTabs');
            } catch (e) {
              Alert.alert('Error', 'Failed to leave group.');
            }
          },
        },
      ]
    );
  };

  const handleCancelInvite = (u: UserProfile) => {
    if (!groupId) return;

    Alert.alert(
      'Cancel Invitation',
      `Are you sure you want to cancel the invitation for ${u.name}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelGroupInvitation(groupId, u.uid);
              Alert.alert('Success', 'Invitation cancelled successfully.');
            } catch (e: any) {
              console.error('Error cancelling invitation:', e);
              Alert.alert('Error', 'Failed to cancel invitation.');
            }
          },
        },
      ]
    );
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
              isDeletingRef.current = true;
              await deleteGroupFromFirestore(groupId);
              navigation.navigate('MainTabs', { screen: 'Groups' } as any);
            } catch (error: any) {
              isDeletingRef.current = false;
              Alert.alert('Error', error.message || 'Failed to delete group.');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'G';
  };

  const groupInitials = getInitials(groupName);

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      {/* App Header */}
      <View style={[styles.topAppBar, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.topAppBarTitle, { color: colors.onSurface }]}>Group Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Photo Upload */}
        <View style={styles.photoUploadCenter}>
          <TouchableOpacity
            style={[styles.photoCircleContainer, { backgroundColor: colors.primaryContainer, borderColor: colors.outlineVariant }]}
            onPress={isOwner ? () => setIsPickerVisible(true) : undefined}
            activeOpacity={isOwner ? 0.8 : 1}
          >
            <SmartImage
              uri={groupPhoto || undefined}
              thumbnailUri={groupPhotoThumbnail || undefined}
              name={groupName}
              size={80}
              fallbackIcon={
                groupType === 'Trip' ? 'flight' :
                groupType === 'Family' ? 'home' :
                groupType === 'Couple' ? 'favorite' :
                groupType === 'Flatmate' ? 'apartment' : 'groups'
              }
            />
            {isOwner && (
              <View style={[styles.photoAddBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                <MaterialIcons name="photo-camera" size={12} color={colors.onPrimary} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.photoActions}>
            {isOwner && groupPhoto ? (
              <TouchableOpacity onPress={handleRemovePhoto}>
                <Text style={[styles.avatarHint, { color: colors.error }]}>Remove Photo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Section 1: Group Basics */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Group name</Text>
          <TextInput
            style={[styles.textInputFull, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface }, !isOwner && { opacity: 0.7 }]}
            placeholder="e.g., Goa Trip"
            placeholderTextColor={colors.outline}
            value={groupName}
            onChangeText={setGroupName}
            editable={isOwner}
          />
        </View>

        {/* Group Type Selector */}
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
                      borderWidth: isSelected ? 0 : 1,
                      opacity: isOwner || isSelected ? 1 : 0.5
                    },
                  ]}
                  onPress={isOwner ? () => setGroupType(t.id) : undefined}
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

        {/* Conditional Fields */}
        {groupType === 'Trip' && (
          <View style={styles.inputGroup}>
            <View style={styles.datesRow}>
              <View style={styles.dateCol}>
                <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Start date</Text>
                <TouchableOpacity
                  style={[styles.dateInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }, !isOwner && { opacity: 0.7 }]}
                  onPress={isOwner ? () => setPickerMode('start') : undefined}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateInputText, { color: colors.onSurface }]}>{formatDateShort(startDate)}</Text>
                  <MaterialIcons name="calendar-today" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <View style={styles.dateCol}>
                <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>End date</Text>
                <TouchableOpacity
                  style={[styles.dateInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }, !isOwner && { opacity: 0.7 }]}
                  onPress={isOwner ? () => setPickerMode('end') : undefined}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateInputText, { color: colors.onSurface }]}>{formatDateShort(endDate)}</Text>
                  <MaterialIcons name="calendar-today" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            </View>

            {isOwner && pickerMode && (
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
              style={[styles.textInputFull, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface }, !isOwner && { opacity: 0.7 }]}
              placeholder="e.g., The Sharma Household"
              placeholderTextColor={colors.outline}
              value={familyName}
              onChangeText={setFamilyName}
              editable={isOwner}
            />
          </View>
        )}

        {groupType === 'Flatmate' && (
          <View style={[styles.inputGroup, styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }, !isOwner && { opacity: 0.7 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Setup monthly split?</Text>
              <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Automate recurring rent & utility bills</Text>
            </View>
            <Switch
              value={setupMonthlySplit}
              onValueChange={isOwner ? setSetupMonthlySplit : undefined}
              trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryContainer }}
              thumbColor={setupMonthlySplit ? colors.primary : colors.outline}
              disabled={!isOwner}
            />
          </View>
        )}

        {isOwner && (
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
        )}

        {/* Section 2: Members */}
        <View style={styles.section}>
          <View style={styles.membersHeaderRow}>
            <Text style={[styles.sectionHeaderTitle, { color: colors.onSurface }]}>Members ({acceptedUsers.length + pendingUsers.length + declinedUsers.length})</Text>
            {isOwner && (
              <TouchableOpacity
                style={styles.addMemberBtn}
                onPress={() => setShowAddMemberModal(true)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="person-add" size={18} color={colors.primary} />
                <Text style={[styles.addMemberText, { color: colors.primary }]}>Add Members</Text>
              </TouchableOpacity>
            )}
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

                  <View style={styles.memberActionsRow}>
                    {isOwner && !isMe && !isCreator && (
                      <TouchableOpacity
                        style={styles.adminActionBtn}
                        onPress={() => handleTransferOwnership(u)}
                      >
                        <MaterialIcons name="security" size={18} color={colors.primary} />
                        <Text style={[styles.adminActionText, { color: colors.primary }]}>Make Admin</Text>
                      </TouchableOpacity>
                    )}

                    {isOwner && !isMe && (
                      <TouchableOpacity
                        style={styles.removeIconBtn}
                        onPress={() => handleRemoveMemberClick(u)}
                      >
                        <MaterialIcons name="person-remove" size={20} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {pendingUsers.map((u, index) => (
              <View
                key={u.uid}
                style={[
                  styles.memberRowItem,
                  (index !== pendingUsers.length - 1 || declinedUsers.length > 0) && [styles.memberRowBorder, { borderBottomColor: colors.divider }],
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

                {isOwner && (
                  <TouchableOpacity
                    style={styles.removeIconBtn}
                    onPress={() => handleCancelInvite(u)}
                  >
                    <MaterialIcons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {declinedUsers.map((u, index) => (
              <View
                key={u.uid}
                style={[
                  styles.memberRowItem,
                  index !== declinedUsers.length - 1 && [styles.memberRowBorder, { borderBottomColor: colors.divider }],
                  { backgroundColor: colors.errorContainer + '22' },
                ]}
              >
                <View style={styles.memberLeftInfo}>
                  <View style={[styles.memberAvatarCircle, { backgroundColor: colors.errorContainer }]}>
                    {u.photoUrl ? (
                      <Image source={{ uri: u.photoUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    ) : (
                      <Text style={[styles.memberAvatarText, { color: colors.error }]}>{u.name ? u.name.charAt(0).toUpperCase() : 'M'}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={[styles.memberItemName, { color: colors.onSurface }]}>{u.name}</Text>
                    <Text style={[styles.memberRoleText, { color: colors.error, fontWeight: '600' }]}>
                      Invitation Declined ❌
                    </Text>
                  </View>
                </View>

                {isOwner && (
                  <TouchableOpacity
                    style={[styles.adminActionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleReinviteMember(u)}
                  >
                    <MaterialIcons name="refresh" size={16} color={colors.onPrimary} />
                    <Text style={[styles.adminActionText, { color: colors.onPrimary }]}>Re-invite</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Section 3: Danger Zone */}
        <View style={styles.dangerSection}>
          {isOwner && (
            <TouchableOpacity
              style={[styles.archiveBtn, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}
              onPress={handleToggleArchive}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={group?.isArchived ? "unarchive" : "archive"}
                size={22}
                color={colors.onSurfaceVariant}
              />
              <Text style={[styles.archiveText, { color: colors.onSurfaceVariant }]}>
                {group?.isArchived ? "Restore Group" : "Archive Group"}
              </Text>
            </TouchableOpacity>
          )}

          {isOwner ? (
            <TouchableOpacity
              style={[styles.deleteGroupBtn, { backgroundColor: isDark ? 'rgba(186, 26, 26, 0.15)' : 'rgba(186, 26, 26, 0.08)', borderColor: 'rgba(186, 26, 26, 0.2)' }]}
              onPress={handleDeleteGroup}
              activeOpacity={0.8}
            >
              <MaterialIcons name="delete-forever" size={22} color={colors.error} />
              <Text style={[styles.deleteGroupText, { color: colors.error }]}>Delete Group</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.deleteGroupBtn, { backgroundColor: isDark ? 'rgba(186, 26, 26, 0.15)' : 'rgba(186, 26, 26, 0.08)', borderColor: 'rgba(186, 26, 26, 0.2)' }]}
              onPress={handleLeaveGroup}
              activeOpacity={0.8}
            >
              <MaterialIcons name="exit-to-app" size={22} color={colors.error} />
              <Text style={[styles.deleteGroupText, { color: colors.error }]}>Leave Group</Text>
            </TouchableOpacity>
          )}
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

      <MediaPickerSheet
        visible={isPickerVisible}
        onDismiss={() => setIsPickerVisible(false)}
        onCamera={takePhoto}
        onGallery={pickFromGallery}
        onFiles={browseFiles}
        onRemove={groupPhoto ? removeMedia : undefined}
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
  avatarText: {
    ...Typography.headlineLg,
    fontSize: 28,
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
  photoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: Spacing.sm,
  },
  actionDivider: {
    width: 1,
    height: 12,
  },
  avatarHint: {
    ...Typography.labelMd,
    fontWeight: '600',
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
  memberActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  adminActionText: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  dangerSection: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  archiveText: {
    ...Typography.titleMd,
    fontWeight: '700',
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
