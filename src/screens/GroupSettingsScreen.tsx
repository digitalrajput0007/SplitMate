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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { OutlinedInput } from '../components/OutlinedInput';
import { auth } from '../config/firebase';
import {
  subscribeToGroupDetail,
  updateGroupInFirestore,
  deleteGroupFromFirestore,
  GroupData,
} from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupSettings'>;

const CATEGORIES: Array<{ id: NonNullable<GroupData['category']>; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { id: 'Travel', label: 'Travel', icon: 'flight' },
  { id: 'Food', label: 'Food', icon: 'restaurant' },
  { id: 'Rent', label: 'Rent', icon: 'home' },
  { id: 'Event', label: 'Event', icon: 'celebration' },
  { id: 'Utilities', label: 'Utilities', icon: 'bolt' },
  { id: 'Other', label: 'Other', icon: 'label' },
];

export default function GroupSettingsScreen({ navigation, route }: Props) {
  const currentUser = auth.currentUser;
  const groupId = route.params?.groupId;

  const [group, setGroup] = useState<GroupData | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NonNullable<GroupData['category']>>('Travel');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (groupId) {
      const unsub = subscribeToGroupDetail(groupId, (data) => {
        if (data) {
          setGroup(data);
          setGroupName(data.name || '');
          if (data.category) setSelectedCategory(data.category);
        }
      });
      return () => unsub();
    }
  }, [groupId]);

  const handleUpdateGroup = async () => {
    if (!groupName.trim() || !groupId) return;
    setSaving(true);
    try {
      await updateGroupInFirestore(groupId, {
        name: groupName.trim(),
        category: selectedCategory,
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

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  const memberList = group?.memberIds || [currentUser?.uid || 'current_user', 'm2', 'm3', 'm4'];

  return (
    <SafeAreaView style={styles.container}>
      <RNStatusBar backgroundColor={Colors.background} barStyle="dark-content" translucent />

      {/* App Header */}
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{groupName || 'Trip to Goa'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Section 1: Group Settings Card */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>Group Settings</Text>
          <View style={styles.cardContainer}>
            <View style={styles.inputBox}>
              <Text style={styles.labelTitle}>Group Name</Text>
              <OutlinedInput
                label="Group Name"
                value={groupName}
                onChangeText={setGroupName}
                placeholder="e.g. Trip to Goa"
              />
            </View>

            {/* Category Selector Pills */}
            <View style={styles.inputBox}>
              <Text style={styles.labelTitle}>Category</Text>
              <View style={styles.categoriesRow}>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryPill,
                        isSelected ? styles.categoryPillSelected : styles.categoryPillUnselected,
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={cat.icon}
                        size={16}
                        color={isSelected ? Colors.onPrimaryContainer : Colors.onSurfaceVariant}
                      />
                      <Text
                        style={[
                          styles.categoryPillText,
                          { color: isSelected ? Colors.onPrimaryContainer : Colors.onSurfaceVariant },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.disabledButton]}
              onPress={handleUpdateGroup}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.onPrimary} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Settings</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Section 2: Members Section */}
        <View style={styles.section}>
          <View style={styles.membersHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Members ({memberList.length})</Text>
            <TouchableOpacity
              style={styles.addMemberBtn}
              onPress={() => (navigation as any).navigate('MainTabs', { screen: 'ContactsTab' })}
              activeOpacity={0.8}
            >
              <MaterialIcons name="person-add" size={18} color={Colors.primary} />
              <Text style={styles.addMemberText}>Add Members</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.membersCardContainer}>
            {memberList.map((id, index) => {
              const isMe = id === currentUser?.uid;
              const roleLabel = isMe ? 'Admin' : 'Member';
              const nameText = isMe ? 'Rahul Sharma (You)' : index === 1 ? 'Priya Patel' : index === 2 ? 'Amit Kumar' : 'Neha Gupta';

              return (
                <View
                  key={id}
                  style={[
                    styles.memberRowItem,
                    index !== memberList.length - 1 && styles.memberRowBorder,
                  ]}
                >
                  <View style={styles.memberLeftInfo}>
                    <View style={styles.memberAvatarCircle}>
                      <Text style={styles.memberAvatarText}>{nameText.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={styles.memberItemName}>{nameText}</Text>
                      <Text style={styles.memberRoleText}>{roleLabel}</Text>
                    </View>
                  </View>

                  {!isMe && (
                    <TouchableOpacity
                      style={styles.removeIconBtn}
                      onPress={() => Alert.alert('Remove Member', `Remove ${nameText} from this group?`)}
                    >
                      <MaterialIcons name="person-remove" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Section 3: Danger Zone */}
        <View style={styles.dangerSection}>
          <TouchableOpacity
            style={styles.deleteGroupBtn}
            onPress={handleDeleteGroup}
            activeOpacity={0.8}
          >
            <MaterialIcons name="delete-forever" size={22} color={Colors.error} />
            <Text style={styles.deleteGroupText}>Delete Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: 40,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeaderTitle: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    fontWeight: '700',
  },
  cardContainer: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.card,
  },
  inputBox: {
    gap: Spacing.xs,
  },
  labelTitle: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  categoryPillSelected: {
    backgroundColor: Colors.primaryContainer,
  },
  categoryPillUnselected: {
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  categoryPillText: {
    ...Typography.labelMd,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
    ...Shadows.button,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveBtnText: {
    ...Typography.titleSm,
    color: Colors.onPrimary,
    fontWeight: '600',
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
    color: Colors.primary,
    fontWeight: '600',
  },
  membersCardContainer: {
    backgroundColor: Colors.surfaceContainerLowest,
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
    borderBottomColor: Colors.surfaceVariant,
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
    backgroundColor: Colors.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    ...Typography.titleSm,
    color: Colors.onSecondaryContainer,
    fontWeight: '700',
  },
  memberItemName: {
    ...Typography.bodyMd,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  memberRoleText: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
  },
  removeIconBtn: {
    padding: 8,
  },
  dangerSection: {
    marginTop: Spacing.sm,
  },
  deleteGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(186, 26, 26, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(186, 26, 26, 0.2)',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  deleteGroupText: {
    ...Typography.titleMd,
    color: Colors.error,
    fontWeight: '700',
  },
});
