import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import {
  UserProfile,
  getSavedUserContactsFromFirestore,
  subscribeToGroupExpenses,
  addMemberToGroupWithPreference,
  ExpenseData,
  formatCurrency,
} from '../services/firestoreService';

interface AddGroupMemberModalProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  existingMemberIds: string[];
  onClose: () => void;
  onMemberAdded: () => void;
}

export function AddGroupMemberModal({
  visible,
  groupId,
  groupName,
  existingMemberIds,
  onClose,
  onMemberAdded,
}: AddGroupMemberModalProps) {
  const currentUser = auth.currentUser;
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [includeExistingExpenses, setIncludeExistingExpenses] = useState(false); // Option B default (recommended)
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && currentUser?.uid) {
      setLoadingContacts(true);
      getSavedUserContactsFromFirestore(currentUser.uid).then((saved) => {
        // Filter out users already in the group
        const available = saved.filter((c) => !existingMemberIds.includes(c.uid));
        setContacts(available);
        setLoadingContacts(false);
      });

      const unsubExp = subscribeToGroupExpenses(groupId, (expList) => {
        setExpenses(expList);
      });

      return () => {
        unsubExp();
      };
    }
  }, [visible, groupId, currentUser, existingMemberIds]);

  // Calculate existing expenses and estimated share
  const totalExistingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const nextMemberCount = existingMemberIds.length + 1;
  const estimatedSharePerUser = totalExistingExpenses > 0 ? totalExistingExpenses / nextMemberCount : 0;

  const handleConfirmAdd = async () => {
    if (!selectedUser) {
      Alert.alert('Select Member', 'Please select a contact to add to this group.');
      return;
    }

    setSubmitting(true);
    try {
      await addMemberToGroupWithPreference(groupId, selectedUser.uid, includeExistingExpenses);
      Alert.alert(
        'Member Added',
        `${selectedUser.name} has been added to ${groupName} (${
          includeExistingExpenses ? 'Splitting all expenses' : 'Splitting new expenses only'
        }).`
      );
      setSelectedUser(null);
      onMemberAdded();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add member to group.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Add Member to {groupName}</Text>
              <Text style={styles.headerSub}>Choose expense splitting preference for new member</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {/* Step 1: Select Contact */}
            <Text style={styles.stepTitle}>1. Select Contact</Text>
            {loadingContacts ? (
              <ActivityIndicator color={Colors.primary} size="small" style={{ marginVertical: 12 }} />
            ) : contacts.length === 0 ? (
              <View style={styles.emptyContactsCard}>
                <Text style={styles.emptyContactsText}>No available contacts found.</Text>
                <Text style={styles.emptyContactsSub}>Add contacts from your phone contacts tab first.</Text>
              </View>
            ) : (
              <View style={styles.contactsList}>
                {contacts.map((c) => {
                  const isSelected = selectedUser?.uid === c.uid;
                  return (
                    <TouchableOpacity
                      key={c.uid}
                      style={[styles.contactRow, isSelected && styles.contactRowSelected]}
                      onPress={() => setSelectedUser(c)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.contactAvatar}>
                        {c.photoUrl ? (
                          <Image source={{ uri: c.photoUrl }} style={styles.avatarImg} />
                        ) : (
                          <Text style={styles.avatarLetter}>{(c.name || 'U').charAt(0).toUpperCase()}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactName}>{c.name}</Text>
                        <Text style={styles.contactSub}>{c.mobile || c.email}</Text>
                      </View>
                      <MaterialIcons
                        name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={22}
                        color={isSelected ? Colors.primary : Colors.outlineVariant}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Step 2: Splitting Preference Options */}
            <Text style={styles.stepTitle}>2. Expense Splitting Preference</Text>
            <View style={styles.optionsGroup}>
              {/* Option B (Default / Recommended) */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  !includeExistingExpenses && styles.optionCardSelected,
                ]}
                onPress={() => setIncludeExistingExpenses(false)}
                activeOpacity={0.85}
              >
                <View style={styles.optionHeaderRow}>
                  <MaterialIcons
                    name={!includeExistingExpenses ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={22}
                    color={!includeExistingExpenses ? Colors.primary : Colors.outlineVariant}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleBadgeRow}>
                      <Text style={styles.optionTitle}>Split only new expenses from now</Text>
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>Recommended</Text>
                      </View>
                    </View>
                    <Text style={styles.optionSub}>
                      {selectedUser
                        ? `Only expenses added after ${selectedUser.name.split(' ')[0]} accepts will count.`
                        : 'Only expenses added after member accepts will count.'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Option A */}
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  includeExistingExpenses && styles.optionCardSelected,
                ]}
                onPress={() => setIncludeExistingExpenses(true)}
                activeOpacity={0.85}
              >
                <View style={styles.optionHeaderRow}>
                  <MaterialIcons
                    name={includeExistingExpenses ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={22}
                    color={includeExistingExpenses ? Colors.primary : Colors.outlineVariant}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>Split all expenses (including existing ones)</Text>
                    <Text style={styles.optionSub}>
                      Existing group expenses: {formatCurrency(totalExistingExpenses)}
                    </Text>
                    {totalExistingExpenses > 0 && selectedUser && (
                      <View style={styles.impactBox}>
                        <Text style={styles.impactText}>
                          Estimated impact: {selectedUser.name.split(' ')[0]} will owe{' '}
                          <Text style={{ fontWeight: '700', color: Colors.primary }}>
                            {formatCurrency(estimatedSharePerUser)}
                          </Text>{' '}
                          from existing expenses.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <TouchableOpacity
            style={[styles.addSubmitBtn, (!selectedUser || submitting) && styles.disabledBtn]}
            onPress={handleConfirmAdd}
            disabled={!selectedUser || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.addSubmitText}>
                {selectedUser ? `Add ${selectedUser.name.split(' ')[0]} to Group` : 'Select a Contact'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { ...Typography.titleLg, color: Colors.onBackground, fontWeight: '700' },
  headerSub: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { gap: Spacing.md, paddingBottom: Spacing.md },
  stepTitle: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '700', marginTop: Spacing.xs },
  emptyContactsCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
  },
  emptyContactsText: { ...Typography.titleSm, color: Colors.onSurface },
  emptyContactsSub: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  contactsList: { gap: Spacing.xs },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.divider,
    gap: 12,
  },
  contactRowSelected: {
    backgroundColor: Colors.primaryFixed,
    borderColor: Colors.primary,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarLetter: { ...Typography.titleSm, color: Colors.onPrimaryContainer, fontWeight: '700' },
  contactName: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
  contactSub: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 2 },
  optionsGroup: { gap: Spacing.sm },
  optionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  optionCardSelected: {
    backgroundColor: Colors.primaryFixed,
    borderColor: Colors.primary,
  },
  optionHeaderRow: { flexDirection: 'row', gap: 10 },
  titleBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  optionTitle: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
  recommendedBadge: {
    backgroundColor: Colors.positiveContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  recommendedText: { fontSize: 10, color: Colors.positiveText, fontWeight: '700' },
  optionSub: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: 4, lineHeight: 18 },
  impactBox: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  impactText: { ...Typography.bodySm, color: Colors.onSurface },
  addSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  disabledBtn: { opacity: 0.5 },
  addSubmitText: { ...Typography.titleMd, color: Colors.onPrimary, fontWeight: '700' },
});
