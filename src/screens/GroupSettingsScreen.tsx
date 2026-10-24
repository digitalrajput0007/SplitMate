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
  Modal,
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
  GroupData,
  UserProfile,
  ExpenseData,
  SettlementData,
  formatCurrency,
  subscribeToAcceptedMembers,
  reinviteUserToGroupInFirestore,
  removeMemberFromGroup,
  redistributeGroupExpensesOnMemberRemoval,
  addSettlementToFirestore,
} from '../services/firestoreService';
import { useMediaManager } from '../hooks/useMediaManager';
import { MediaPickerSheet } from '../components/MediaPickerSheet';
import { SmartImage } from '../components/SmartImage';
import { useTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
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
  const dialog = useDialog();

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
  const [enableTripDates, setEnableTripDates] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [pickerMode, setPickerMode] = useState<'start' | 'end' | 'family' | 'flatmate' | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [setupMonthlySplit, setSetupMonthlySplit] = useState(false);
  const [enableFamilyReminder, setEnableFamilyReminder] = useState(false);
  const [familyReminderDate, setFamilyReminderDate] = useState<Date>(new Date());
  const [enableBalanceAlert, setEnableBalanceAlert] = useState(false);
  const [balanceAlertThreshold, setBalanceAlertThreshold] = useState('2000');
  const [enableFlatmateSettleReminder, setEnableFlatmateSettleReminder] = useState(false);
  const [flatmateReminderDate, setFlatmateReminderDate] = useState<Date>(new Date());

  const [acceptedUsers, setAcceptedUsers] = useState<UserProfile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [declinedUsers, setDeclinedUsers] = useState<UserProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [userExpenses, setUserExpenses] = useState<ExpenseData[]>([]);
  const [userSettlements, setUserSettlements] = useState<SettlementData[]>([]);
  const isDeletingRef = useRef(false);

  // Transfer Admin & Leave Group State
  const [transferAdminModalVisible, setTransferAdminModalVisible] = useState(false);
  const [selectedNewAdminUid, setSelectedNewAdminUid] = useState<string | null>(null);
  const [transferringAdmin, setTransferringAdmin] = useState(false);

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
          if (data.enableDates !== undefined) setEnableTripDates(data.enableDates);
          if (data.familyName) setFamilyName(data.familyName);
          if (data.setupMonthlySplit !== undefined) setSetupMonthlySplit(data.setupMonthlySplit);
          if (data.enableSettleReminder !== undefined) setEnableFamilyReminder(data.enableSettleReminder);
          if (data.settleReminderDate) setFamilyReminderDate(new Date(data.settleReminderDate));
          if (data.enableBalanceAlert !== undefined) setEnableBalanceAlert(data.enableBalanceAlert);
          if (data.balanceAlertThreshold !== undefined) setBalanceAlertThreshold(data.balanceAlertThreshold.toString());
          if (data.enableFlatmateSettleReminder !== undefined) setEnableFlatmateSettleReminder(data.enableFlatmateSettleReminder);
          if (data.flatmateReminderDate) setFlatmateReminderDate(new Date(data.flatmateReminderDate));
        } else if (!isDeletingRef.current) {
          dialog.showError(
            'Group Deleted',
            'The group owner has deleted this group.',
            () => {
              navigation.navigate('MainTabs', { screen: 'Groups' } as any);
            }
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
      dialog.showWarning('Validation Error', 'Group name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const formattedStart = (groupType === 'Trip' && enableTripDates) ? startDate.toISOString().split('T')[0] : undefined;
      const formattedEnd = (groupType === 'Trip' && enableTripDates) ? endDate.toISOString().split('T')[0] : undefined;
      const formattedFamilyReminder = (groupType === 'Family' && enableFamilyReminder) ? familyReminderDate.toISOString().split('T')[0] : undefined;
      const formattedFlatmateReminder = (groupType === 'Flatmate' && enableFlatmateSettleReminder) ? flatmateReminderDate.toISOString().split('T')[0] : undefined;
      const alertThresholdNum = (groupType === 'Couple' && enableBalanceAlert) ? parseFloat(balanceAlertThreshold) || 2000 : undefined;

      const updateData: any = {
        name: groupName.trim(),
        groupType,
        photoUrl: groupPhoto || '',
        photoThumbnailUrl: groupPhotoThumbnail || '',
        photoMetadata: groupPhotoMetadata,
        enableDates: groupType === 'Trip' && enableTripDates,
      };

      if (groupType === 'Family') {
        updateData.familyName = familyName.trim();
        updateData.enableSettleReminder = enableFamilyReminder;
        updateData.settleReminderDate = formattedFamilyReminder;
      }
      if (groupType === 'Couple') {
        updateData.enableBalanceAlert = enableBalanceAlert;
        updateData.balanceAlertThreshold = alertThresholdNum;
      }
      if (groupType === 'Flatmate') {
        updateData.setupMonthlySplit = setupMonthlySplit;
        updateData.enableFlatmateSettleReminder = enableFlatmateSettleReminder;
        updateData.flatmateReminderDate = formattedFlatmateReminder;
      }
      if (groupType === 'Trip') {
        updateData.startDate = formattedStart;
        updateData.endDate = formattedEnd;
      }

      await updateGroupInFirestore(groupId, updateData);
      dialog.showSuccess('Group Updated', 'Group settings updated successfully.');
    } catch (error: any) {
      console.error('Error updating group:', error);
      dialog.showError('Error', error.message || 'Failed to update group.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransferOwnership = (u: UserProfile) => {
    if (!groupId) return;

    dialog.showConfirm(
      'Transfer Ownership',
      `Are you sure you want to make ${u.name} the owner of this group? You will lose administrative privileges.`,
      async () => {
        try {
          await transferGroupOwnership(groupId, u.uid);
          dialog.showSuccess('Success', `${u.name} is now the group owner.`);
        } catch (e) {
          dialog.showError('Error', 'Failed to transfer ownership.');
        }
      },
      { confirmText: 'Transfer' }
    );
  };

  const handleReinviteMember = async (u: UserProfile) => {
    if (!groupId) return;
    try {
      await reinviteUserToGroupInFirestore(groupId, u.uid);
      dialog.showSuccess('Re-invited', `A new invitation request has been sent to ${u.name}.`);
    } catch (error: any) {
      console.error('Re-invite error details:', error);
      dialog.showError('Error', error?.message || 'Failed to re-invite member.');
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
      dialog.showConfirm(
        'Remove Member',
        `Remove ${u.name} from this group? They will no longer see group expenses.`,
        async () => {
          try {
            await removeMemberFromGroup(groupId, u.uid);
            dialog.showSuccess('Removed', `${u.name} has been removed from the group.`);
          } catch (err) {
            dialog.showError('Error', 'Failed to remove member.');
          }
        },
        { confirmText: 'Remove', destructive: true }
      );
      return;
    }

    const isOwed = balance > 0;
    const absVal = Math.abs(balance);
    const formattedVal = formatCurrency(absVal);
    const statusText = isOwed ? `is owed ${formattedVal}` : `owes ${formattedVal}`;

    dialog.showDialog({
      title: 'Unsettled Balance Warning ⚠️',
      message: `${u.name} ${statusText} in this group. Choose how to handle this balance before removing them:`,
      type: 'warning',
      actions: [
        {
          text: 'Cancel',
          variant: 'ghost',
        },
        {
          text: 'Mark Settled',
          variant: 'primary',
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
              dialog.showSuccess('Success', `Settled ${formattedVal} and removed ${u.name}.`);
            } catch (e) {
              dialog.showError('Error', 'Failed to settle and remove member.');
            }
          },
        },
        {
          text: 'Redistribute',
          variant: 'outline',
          onPress: async () => {
            try {
              const remainingMembers = acceptedUsers.filter(x => x.uid !== u.uid);
              if (remainingMembers.length === 0) {
                dialog.showError('Error', 'No remaining members to redistribute balance to.');
                return;
              }
              const remainingMemberUids = remainingMembers.map(x => x.uid);

              // 1. Redistribute existing expenses among remaining members so updated owes are calculated correctly
              await redistributeGroupExpensesOnMemberRemoval(groupId, u.uid, remainingMemberUids);

              // 2. Remove member from group
              await removeMemberFromGroup(groupId, u.uid);

              dialog.showSuccess('Success', `Redistributed balance among remaining members and removed ${u.name}.`);
            } catch (e) {
              console.error('Error redistributing balance on member removal:', e);
              dialog.showError('Error', 'Failed to redistribute balance and remove member.');
            }
          },
        },
      ],
    });
  };

  const handleToggleArchive = async () => {
    if (!groupId) return;
    const isCurrentlyArchived = group?.isArchived || false;

    dialog.showConfirm(
      isCurrentlyArchived ? 'Restore Group' : 'Archive Group',
      isCurrentlyArchived
        ? 'Do you want to restore this group to your active list?'
        : 'Archiving hides the group from your main list but keeps all records. Continue?',
      async () => {
        try {
          await toggleGroupArchive(groupId, !isCurrentlyArchived);
          dialog.showSuccess('Success', isCurrentlyArchived ? 'Group restored.' : 'Group archived.');
          if (!isCurrentlyArchived) {
            navigation.goBack();
          }
        } catch (e) {
          dialog.showError('Error', 'Failed to update archive status.');
        }
      },
      { confirmText: isCurrentlyArchived ? 'Restore' : 'Archive' }
    );
  };

  const handleLeaveGroup = () => {
    if (!groupId || !currentUser) return;

    // 1. Check Outstanding Balance
    const currentBalance = calculateUserBalance();
    if (Math.abs(currentBalance) > 0.05) {
      dialog.showWarning(
        'Outstanding Balance',
        `You cannot leave the group until your balance is zero. Your current balance: ${formatCurrency(currentBalance)}.`
      );
      return;
    }

    const otherMembers = acceptedUsers.filter((u) => u.uid !== currentUser.uid);

    // 2. Sole Member Case: Delete group directly
    if (otherMembers.length === 0) {
      dialog.showConfirm(
        'Delete Group',
        'You are the only member in this group. Leaving will permanently delete this group and all its records.',
        async () => {
          isDeletingRef.current = true;
          try {
            await deleteGroupFromFirestore(groupId);
            navigation.navigate('MainTabs', { screen: 'Groups' } as any);
          } catch (e) {
            isDeletingRef.current = false;
            dialog.showError('Error', 'Failed to delete group.');
          }
        },
        { confirmText: 'Delete Group', destructive: true }
      );
      return;
    }

    // 3. Evaluate Sole Admin Status
    const isOwner = group?.createdBy === currentUser.uid;
    const adminList = group?.adminIds && group.adminIds.length > 0 ? group.adminIds : (group?.createdBy ? [group.createdBy] : []);
    const otherAdmins = adminList.filter((id: string) => id !== currentUser.uid && otherMembers.some((m) => m.uid === id));
    const isSoleAdmin = (isOwner || adminList.includes(currentUser.uid)) && otherAdmins.length === 0;

    // 4. Sole Admin Case: Require admin rights transfer
    if (isSoleAdmin) {
      setSelectedNewAdminUid(otherMembers[0]?.uid || null);
      setTransferAdminModalVisible(true);
      return;
    }

    // 5. Standard Leave Confirmation
    dialog.showConfirm(
      'Leave Group',
      'Are you sure you want to leave this group? You will no longer be able to see expenses or contribute.',
      async () => {
        try {
          await leaveGroupInFirestore(groupId, currentUser.uid);
          navigation.navigate('MainTabs', { screen: 'Groups' } as any);
        } catch (e) {
          dialog.showError('Error', 'Failed to leave group.');
        }
      },
      { confirmText: 'Leave', destructive: true }
    );
  };

  const handleConfirmTransferAndLeave = async () => {
    if (!groupId || !currentUser || !selectedNewAdminUid) {
      dialog.showWarning('Selection Required', 'Please select a member to promote to Admin.');
      return;
    }

    setTransferringAdmin(true);
    try {
      // Promote selected member to admin
      await transferGroupOwnership(groupId, selectedNewAdminUid);

      // Now leave the group
      await leaveGroupInFirestore(groupId, currentUser.uid);

      setTransferringAdmin(false);
      setTransferAdminModalVisible(false);
      navigation.navigate('MainTabs', { screen: 'Groups' } as any);
    } catch (e: any) {
      setTransferringAdmin(false);
      dialog.showError('Error', e.message || 'Failed to transfer admin rights and leave group.');
    }
  };

  const handleCancelInvite = (u: UserProfile) => {
    if (!groupId) return;

    dialog.showConfirm(
      'Cancel Invitation',
      `Are you sure you want to cancel the invitation for ${u.name}?`,
      async () => {
        try {
          await cancelGroupInvitation(groupId, u.uid);
          dialog.showSuccess('Success', 'Invitation cancelled successfully.');
        } catch (e: any) {
          console.error('Error cancelling invitation:', e);
          dialog.showError('Error', 'Failed to cancel invitation.');
        }
      },
      { confirmText: 'Yes, Cancel', destructive: true }
    );
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;

    dialog.showConfirm(
      'Delete Group',
      'Are you sure you want to delete this group? All expense records for this group will be deleted.',
      async () => {
        try {
          isDeletingRef.current = true;
          await deleteGroupFromFirestore(groupId);
          navigation.navigate('MainTabs', { screen: 'Groups' } as any);
        } catch (error: any) {
          isDeletingRef.current = false;
          dialog.showError('Error', error.message || 'Failed to delete group.');
        }
      },
      { confirmText: 'Delete', destructive: true }
    );
  };

  const getInitials = (name: string) => {
    return (name || '')
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
            onPress={isOwner && !isUploading ? () => setIsPickerVisible(true) : undefined}
            activeOpacity={isOwner && !isUploading ? 0.8 : 1}
            disabled={isUploading}
          >
            <View style={{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden', opacity: isUploading ? 0.7 : 1 }}>
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
              {isUploading && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 40, alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700', marginTop: 2 }}>{Math.round(progress)}%</Text>
                </View>
              )}
            </View>
            {isOwner && (
              <View style={[styles.photoAddBadge, { backgroundColor: isUploading ? colors.outline : colors.primary, borderColor: colors.surface }]}>
                <MaterialIcons name="photo-camera" size={12} color={colors.onPrimary} />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.photoActions}>
            {isOwner && groupPhoto ? (
              <TouchableOpacity onPress={handleRemovePhoto} disabled={isUploading}>
                <Text style={[styles.avatarHint, { color: isUploading ? colors.outline : colors.error }]}>Remove Photo</Text>
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
            <View style={[styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, marginBottom: enableTripDates ? 12 : 0 }, !isOwner && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Add trip dates?</Text>
                <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Set start and end dates for your trip</Text>
              </View>
              <Switch
                value={enableTripDates}
                onValueChange={isOwner ? setEnableTripDates : undefined}
                trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryContainer }}
                thumbColor={enableTripDates ? colors.primary : colors.outline}
                disabled={!isOwner}
              />
            </View>

            {enableTripDates && (
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
            )}
          </View>
        )}

        {groupType === 'Family' && (
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Family name (Optional)</Text>
            <TextInput
              style={[styles.textInputFull, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface, marginBottom: 12 }, !isOwner && { opacity: 0.7 }]}
              placeholder="e.g., The Sharma Household"
              placeholderTextColor={colors.outline}
              value={familyName}
              onChangeText={setFamilyName}
              editable={isOwner}
            />

            <View style={[styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, marginBottom: enableFamilyReminder ? 12 : 0 }, !isOwner && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Enable Settle Up Reminder?</Text>
                <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Send reminder notification to all family members on a date</Text>
              </View>
              <Switch
                value={enableFamilyReminder}
                onValueChange={isOwner ? setEnableFamilyReminder : undefined}
                trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryContainer }}
                thumbColor={enableFamilyReminder ? colors.primary : colors.outline}
                disabled={!isOwner}
              />
            </View>

            {enableFamilyReminder && (
              <View style={styles.dateCol}>
                <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Reminder date</Text>
                <TouchableOpacity
                  style={[styles.dateInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }, !isOwner && { opacity: 0.7 }]}
                  onPress={isOwner ? () => setPickerMode('family') : undefined}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateInputText, { color: colors.onSurface }]}>{formatDateShort(familyReminderDate)}</Text>
                  <MaterialIcons name="calendar-today" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {groupType === 'Couple' && (
          <View style={styles.inputGroup}>
            <View style={[styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, marginBottom: enableBalanceAlert ? 12 : 0 }, !isOwner && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Set balance alert?</Text>
                <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Alert the group when someone's balance reaches a set amount</Text>
              </View>
              <Switch
                value={enableBalanceAlert}
                onValueChange={isOwner ? setEnableBalanceAlert : undefined}
                trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryContainer }}
                thumbColor={enableBalanceAlert ? colors.primary : colors.outline}
                disabled={!isOwner}
              />
            </View>

            {enableBalanceAlert && (
              <View style={{ gap: 6 }}>
                <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Alert threshold amount (₹)</Text>
                <TextInput
                  style={[styles.textInputFull, { borderColor: colors.outlineVariant, color: colors.onSurface, backgroundColor: colors.surfaceContainerLowest }, !isOwner && { opacity: 0.7 }]}
                  placeholder="e.g., 2000"
                  placeholderTextColor={colors.outline}
                  keyboardType="numeric"
                  value={balanceAlertThreshold}
                  onChangeText={setBalanceAlertThreshold}
                  editable={isOwner}
                />
              </View>
            )}
          </View>
        )}

        {groupType === 'Flatmate' && (
          <View style={styles.inputGroup}>
            <View style={[styles.switchCard, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, marginBottom: enableFlatmateSettleReminder ? 12 : 0 }, !isOwner && { opacity: 0.7 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.switchTitle, { color: colors.onSurface }]}>Remind to settle up?</Text>
                <Text style={[styles.switchSubtitle, { color: colors.onSurfaceVariant }]}>Trigger monthly notification to members who owe balance</Text>
              </View>
              <Switch
                value={enableFlatmateSettleReminder}
                onValueChange={isOwner ? setEnableFlatmateSettleReminder : undefined}
                trackColor={{ false: colors.surfaceContainerHighest, true: colors.primaryContainer }}
                thumbColor={enableFlatmateSettleReminder ? colors.primary : colors.outline}
                disabled={!isOwner}
              />
            </View>

            {enableFlatmateSettleReminder && (
              <View style={styles.dateCol}>
                <Text style={[styles.inputLabel, { color: colors.onSurfaceVariant }]}>Reminder date</Text>
                <TouchableOpacity
                  style={[styles.dateInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }, !isOwner && { opacity: 0.7 }]}
                  onPress={isOwner ? () => setPickerMode('flatmate') : undefined}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateInputText, { color: colors.onSurface }]}>{formatDateShort(flatmateReminderDate)}</Text>
                  <MaterialIcons name="calendar-today" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {isOwner && pickerMode && (
          <DateTimePicker
            value={pickerMode === 'start' ? startDate : pickerMode === 'end' ? endDate : pickerMode === 'family' ? familyReminderDate : flatmateReminderDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, selected) => {
              if (Platform.OS === 'android') {
                setPickerMode(null);
              }

              if (selected && event.type !== 'dismissed') {
                if (pickerMode === 'start') {
                  setStartDate(selected);
                  if (selected > endDate) setEndDate(selected);
                } else if (pickerMode === 'end') {
                  if (selected < startDate) setEndDate(startDate);
                  else setEndDate(selected);
                } else if (pickerMode === 'family') {
                  setFamilyReminderDate(selected);
                } else if (pickerMode === 'flatmate') {
                  setFlatmateReminderDate(selected);
                }
              }

              if (Platform.OS === 'ios') {
                setPickerMode(null);
              }
            }}
          />
        )}

        {isOwner && (
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }, (saving || isUploading) && styles.disabledButton]}
            onPress={handleUpdateGroup}
            activeOpacity={0.85}
            disabled={saving || isUploading}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>
                {isUploading ? 'Uploading Image...' : 'Update Group'}
              </Text>
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

      {/* Transfer Admin Rights & Leave Group Modal */}
      <Modal
        visible={transferAdminModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!transferringAdmin) setTransferAdminModalVisible(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.onSurface }]}>Assign New Admin</Text>
              <TouchableOpacity
                onPress={() => !transferringAdmin && setTransferAdminModalVisible(false)}
                style={styles.modalCloseBtn}
                disabled={transferringAdmin}
              >
                <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.rowSub, { color: colors.onSurfaceVariant, marginBottom: Spacing.md }]}>
              You are currently the sole admin of this group. Please select a member to promote as Admin before leaving.
            </Text>

            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
              {acceptedUsers
                .filter((u) => u.uid !== currentUser?.uid)
                .map((user) => {
                  const isSelected = selectedNewAdminUid === user.uid;
                  return (
                    <TouchableOpacity
                      key={user.uid}
                      style={[
                        styles.memberPickerRow,
                        { borderColor: isSelected ? colors.primary : colors.divider, backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceContainerLow }
                      ]}
                      onPress={() => setSelectedNewAdminUid(user.uid)}
                      disabled={transferringAdmin}
                    >
                      <SmartImage
                        uri={user.photoThumbnailUrl || user.photoUrl}
                        name={user.name}
                        size={36}
                        style={{ borderRadius: 18 }}
                      />
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <Text style={[styles.rowTitle, { color: isSelected ? colors.onPrimaryContainer : colors.onSurface }]}>
                          {user.name || 'Group Member'}
                        </Text>
                        <Text style={[styles.rowSub, { color: isSelected ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                          {user.email || user.mobile || ''}
                        </Text>
                      </View>
                      <MaterialIcons
                        name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={22}
                        color={isSelected ? colors.primary : colors.outline}
                      />
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: Spacing.md }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.outlineVariant }]}
                onPress={() => setTransferAdminModalVisible(false)}
                disabled={transferringAdmin}
              >
                <Text style={[styles.modalCancelText, { color: colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }, transferringAdmin && { opacity: 0.6 }]}
                onPress={handleConfirmTransferAndLeave}
                disabled={transferringAdmin || !selectedNewAdminUid}
              >
                {transferringAdmin ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.modalSubmitText, { color: colors.onPrimary }]}>Promote & Leave</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  memberPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    ...Typography.titleLg,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
  rowTitle: {
    ...Typography.bodyMd,
    fontWeight: '600',
  },
  rowSub: {
    ...Typography.bodySm,
  },
});
