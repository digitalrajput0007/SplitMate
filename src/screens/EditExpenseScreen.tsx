import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import {
  updateExpenseInFirestore,
  addActivityToFirestore,
  subscribeToGroupDetail,
  Member
} from '../services/firestoreService';
import { ExpenseForm, ExpenseFormHandle } from '../components/ExpenseForm';
import { useTheme } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'EditExpense'>;

export default function EditExpenseScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const expense = route.params.expense;
  const currentUid = auth.currentUser?.uid || 'user_current';

  const formRef = useRef<ExpenseFormHandle>(null);
  const [submitting, setSubmitting] = useState(false);
  const [groupMembers, setGroupMembers] = useState<Member[]>([]);
  const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>(
    Object.keys(expense.splitDetails).filter(uid => expense.splitDetails[uid] > 0)
  );

  useEffect(() => {
    const unsub = subscribeToGroupDetail(expense.groupId, (group) => {
      if (group && group.memberProfiles) {
        const members: Member[] = Object.values(group.memberProfiles).map(p => ({
          uid: p.uid,
          name: p.name
        }));
        setGroupMembers(members);
      } else if (group && group.memberIds) {
        // Fallback if profiles not loaded
        const members: Member[] = group.memberIds.map(uid => ({
          uid,
          name: uid === currentUid ? 'You' : uid.split('_')[1] || 'Member'
        }));
        setGroupMembers(members);
      }
    });
    return () => unsub();
  }, [expense.groupId]);

  const handleSave = async () => {
    const response = formRef.current?.getFormData();
    if (!response) return;

    if (response.error) {
      Alert.alert('Validation Error', response.error);
      return;
    }

    if (!response.data || !expense.expenseId) return;

    setSubmitting(true);
    try {
      const updatedExpense = {
        ...expense,
        ...response.data,
      };

      await updateExpenseInFirestore(expense.expenseId, response.data);

      // Create activity log entry
      await addActivityToFirestore({
        type: 'activity',
        title: `Expense Updated`,
        subtitle: `"${expense.title}" was modified in ${expense.groupName || 'Group'}`,
        amount: response.data.amount,
        category: response.data.category,
        groupName: expense.groupName,
        groupId: expense.groupId
      });

      // Pass updated expense back to detail screen
      navigation.navigate('ExpenseDetail', { expense: updatedExpense });
    } catch (error: any) {
      console.error('Error updating expense:', error);
      Alert.alert('Error', error.message || 'Failed to update expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="close" size={24} color={colors.onBackground} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>Edit Expense</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {groupMembers.length > 0 ? (
            <ExpenseForm
              ref={formRef}
              members={groupMembers}
              currentUid={currentUid}
              initialData={expense}
              selectedMemberUids={selectedMemberUids}
              onSelectedMembersChange={setSelectedMemberUids}
            />
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary },
              submitting && styles.disabledBtn
            ]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={submitting || groupMembers.length === 0}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  loadingBox: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  submitBtn: {
    width: '100%',
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  disabledBtn: { opacity: 0.6 },
  submitBtnText: { ...Typography.titleMd },
});
