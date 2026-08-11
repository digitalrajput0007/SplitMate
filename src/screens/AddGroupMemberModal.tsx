import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  TextInput,
  Share,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import {
  Contact,
  getSavedUserContactsFromFirestore,
  findUserByPhone,
  subscribeToGroupExpenses,
  addMemberToGroupWithPreference,
  ExpenseData,
  formatCurrency,
} from '../services/firestoreService';
import { useTheme } from '../context/ThemeContext';

interface AddGroupMemberModalProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  existingMemberIds: string[];
  onClose: () => void;
  onMemberAdded: () => void;
}

interface CombinedContact extends Contact {
  isRegistered: boolean;
}

export function AddGroupMemberModal({
  visible,
  groupId,
  groupName,
  existingMemberIds,
  onClose,
  onMemberAdded,
}: AddGroupMemberModalProps) {
  const { colors } = useTheme();
  const currentUser = auth.currentUser;

  const [searchQuery, setSearchQuery] = useState('');
  const [allPlatformUsers, setAllPlatformUsers] = useState<UserProfile[]>([]);
  const [savedContacts, setSavedContacts] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<CombinedContact | null>(null);

  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [includeExistingExpenses, setIncludeExistingExpenses] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && currentUser?.uid) {
      setLoading(true);

      const loadData = async () => {
        try {
          const saved = await getSavedUserContactsFromFirestore(currentUser.uid);
          setSavedContacts(saved as any);
        } catch (e) {
          console.log('Error loading members data:', e);
        } finally {
          setLoading(false);
        }
      };

      loadData();

      const unsubExp = subscribeToGroupExpenses(groupId, (expList) => {
        setExpenses(expList);
      });

      return () => unsubExp();
    }
  }, [visible, groupId, currentUser, existingMemberIds]);

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show saved contacts by default
      return savedContacts
        .filter(c => !existingMemberIds.includes(c.uid))
        .map(c => ({ ...c, isRegistered: true, isSavedContact: true } as CombinedContact));
    }

    const query = searchQuery.toLowerCase();

    return savedContacts
      .filter(c =>
        !existingMemberIds.includes(c.uid || '') &&
        c.uid !== currentUser?.uid &&
        (c.name.toLowerCase().includes(query) ||
         (c.phone && c.phone.includes(query)) ||
         (c.email && c.email.toLowerCase().includes(query)))
      )
      .map(c => ({
        ...c,
        isRegistered: !!c.uid,
      } as CombinedContact));
  }, [searchQuery, savedContacts, existingMemberIds, currentUser]);

  const handleSearchByPhone = async () => {
    if (searchQuery.length < 10) return;
    setLoading(true);
    try {
      const user = await findUserByPhone(searchQuery);
      if (user && !existingMemberIds.includes(user.uid)) {
        // Automatically add to list if found and not in group
        const newContact: Contact = {
          name: user.name,
          phone: user.mobile || '',
          uid: user.uid,
          photoUrl: user.photoUrl,
        };
        setSavedContacts(prev => [newContact, ...prev]);
        setSelectedUser({ ...newContact, isRegistered: true } as CombinedContact);
      }
    } catch (e) {
      console.log('Phone search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const totalExistingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const nextMemberCount = existingMemberIds.length + 1;
  const estimatedSharePerUser = totalExistingExpenses > 0 ? totalExistingExpenses / nextMemberCount : 0;

  const handleConfirmAdd = async () => {
    if (!selectedUser || !selectedUser.uid) {
      Alert.alert('Error', 'Only users registered on SplitMate can be added to groups currently.');
      return;
    }

    setSubmitting(true);
    try {
      await addMemberToGroupWithPreference(groupId, selectedUser.uid, includeExistingExpenses);
      Alert.alert(
        'Member Added',
        `${selectedUser.name} added to ${groupName}.`
      );
      setSelectedUser(null);
      setSearchQuery('');
      setIncludeExistingExpenses(false);
      onMemberAdded();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvite = async () => {
    try {
      const shareMessage = `Join me on SplitMate to split bills & track group expenses! Download here: https://splitmate.app`;
      await Share.share({ message: shareMessage });
    } catch (error) {
      console.log('Error sharing invite:', error);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerTitle, { color: colors.onBackground }]}>Add Member</Text>
              <Text style={[styles.headerSub, { color: colors.onSurfaceVariant }]}>Search and add people to {groupName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surfaceContainerLow }]}>
              <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            <MaterialIcons name="search" size={20} color={colors.outline} />
            <TextInput
              style={[styles.searchInput, { color: colors.onSurface }]}
              placeholder="Search by name, email or mobile"
              placeholderTextColor={colors.outline}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchByPhone}
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={18} color={colors.outline} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color={colors.primary} size="small" style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.resultsList}>
                {filteredResults.length === 0 && searchQuery.trim() !== '' ? (
                  <View style={styles.noResultsBox}>
                    <Text style={[styles.noResultsText, { color: colors.onSurface }]}>No SplitMate user found</Text>
                    <TouchableOpacity style={[styles.inviteSmallBtn, { borderColor: colors.primary }]} onPress={handleInvite}>
                      <Text style={[styles.inviteSmallBtnText, { color: colors.primary }]}>Invite to SplitMate</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  filteredResults.map((u) => {
                    const isSelected = selectedUser?.phone === u.phone;
                    return (
                      <TouchableOpacity
                        key={u.phone}
                        style={[
                          styles.contactRow,
                          { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                          isSelected && { backgroundColor: colors.primaryFixed, borderColor: colors.primary }
                        ]}
                        onPress={() => setSelectedUser(u)}
                      >
                        <View style={[styles.contactAvatar, { backgroundColor: colors.primaryContainer }]}>
                          {u.photoUrl ? (
                            <Image source={{ uri: u.photoUrl }} style={styles.avatarImg} />
                          ) : (
                            <Text style={[styles.avatarLetter, { color: colors.onPrimaryContainer }]}>
                              {u.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.contactName, { color: colors.onSurface }]} numberOfLines={1}>{u.name}</Text>
                            {u.uid && (
                              <View style={[styles.badge, { backgroundColor: colors.positiveContainer }]}>
                                <Text style={[styles.badgeText, { color: colors.positiveText }]}>On SplitMate</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.contactSub, { color: colors.onSurfaceVariant }]}>{u.phone || u.email}</Text>
                        </View>
                        <MaterialIcons
                          name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                          size={22}
                          color={isSelected ? colors.primary : colors.outlineVariant}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            {selectedUser && (
              <View style={styles.preferenceSection}>
                <Text style={[styles.stepTitle, { color: colors.onSurface }]}>Previous Expense Handling</Text>

                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                    !includeExistingExpenses && { backgroundColor: colors.primaryFixed, borderColor: colors.primary },
                  ]}
                  onPress={() => setIncludeExistingExpenses(false)}
                >
                  <View style={styles.optionHeaderRow}>
                    <MaterialIcons
                      name={!includeExistingExpenses ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20}
                      color={!includeExistingExpenses ? colors.primary : colors.outlineVariant}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.optionTitle, { color: colors.onSurface }]}>Only future expenses</Text>
                        <View style={[styles.badge, { backgroundColor: colors.positiveContainer }]}>
                          <Text style={[styles.badgeText, { color: colors.positiveText }]}>Recommended</Text>
                        </View>
                      </View>
                      <Text style={[styles.optionSub, { color: colors.onSurfaceVariant }]}>Member only splits bills added from now on.</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.optionCard,
                    { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider },
                    includeExistingExpenses && { backgroundColor: colors.primaryFixed, borderColor: colors.primary },
                  ]}
                  onPress={() => setIncludeExistingExpenses(true)}
                >
                  <View style={styles.optionHeaderRow}>
                    <MaterialIcons
                      name={includeExistingExpenses ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20}
                      color={includeExistingExpenses ? colors.primary : colors.outlineVariant}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: colors.onSurface }]}>Include previous expenses</Text>
                      {totalExistingExpenses > 0 && (
                        <Text style={[styles.impactText, { color: colors.primary }]}>
                          Member will owe approx {formatCurrency(estimatedSharePerUser)} from {formatCurrency(totalExistingExpenses)} in past bills.
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Footer Action */}
          <TouchableOpacity
            style={[
              styles.addSubmitBtn,
              { backgroundColor: colors.primary },
              (!selectedUser || submitting) && styles.disabledBtn
            ]}
            onPress={handleConfirmAdd}
            disabled={!selectedUser || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.addSubmitText, { color: colors.onPrimary }]}>
                {selectedUser ? `Add ${(selectedUser.name || 'Member').split(' ')[0]}` : 'Select a person'}
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
    marginBottom: 4,
  },
  headerTitle: { ...Typography.titleLg, fontWeight: '700' },
  headerSub: { ...Typography.bodySm, marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, ...Typography.bodyMd },
  modalScroll: { gap: Spacing.md, paddingBottom: Spacing.md },
  resultsList: { gap: Spacing.xs, marginTop: Spacing.xs },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 12,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarLetter: { ...Typography.titleMd, fontWeight: '700' },
  contactName: { ...Typography.titleSm, fontWeight: '600', maxWidth: 140 },
  contactSub: { ...Typography.bodySm, marginTop: 2 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 9, fontWeight: '700' },
  noResultsBox: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  noResultsText: { ...Typography.bodyMd, opacity: 0.7 },
  inviteSmallBtn: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  inviteSmallBtnText: { ...Typography.labelLg, fontWeight: '700' },
  preferenceSection: { gap: Spacing.sm, marginTop: Spacing.md },
  stepTitle: { ...Typography.labelLg, fontWeight: '700', marginBottom: 4 },
  optionCard: {
    borderRadius: BorderRadius.lg,
    padding: 12,
    borderWidth: 1,
  },
  optionHeaderRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  optionTitle: { ...Typography.titleSm, fontWeight: '600' },
  optionSub: { ...Typography.bodySm, marginTop: 2 },
  impactText: { ...Typography.labelMd, fontWeight: '700', marginTop: 4 },
  addSubmitBtn: {
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  disabledBtn: { opacity: 0.5 },
  addSubmitText: { ...Typography.titleMd, fontWeight: '700' },
});
