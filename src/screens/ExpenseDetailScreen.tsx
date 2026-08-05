import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { formatCurrency } from '../services/currencyService';
import {
  updateExpenseInFirestore,
  deleteExpenseFromFirestore,
  ExpenseData,
} from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

export default function ExpenseDetailScreen({ navigation, route }: Props) {
  const expense: ExpenseData = route.params?.expense;

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(expense?.title || '');
  const [amount, setAmount] = useState(expense?.amount?.toString() || '');
  const [saving, setSaving] = useState(false);

  if (!expense) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Expense Details</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
    );
  }

  const handleUpdate = async () => {
    if (!title.trim() || !expense.expenseId) return;
    const parsed = parseFloat(amount) || expense.amount;

    setSaving(true);
    try {
      await updateExpenseInFirestore(expense.expenseId, {
        title: title.trim(),
        amount: parsed,
      });
      Alert.alert('Expense Updated', 'The expense details have been updated.');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Error updating expense:', error);
      Alert.alert('Error', error.message || 'Failed to update expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!expense.expenseId) return;

    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense.title}"? Group balances will be recalculated immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpenseFromFirestore(expense.expenseId!);
              Alert.alert('Expense Deleted', 'Expense removed from group records.');
              navigation.goBack();
            } catch (error: any) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', error.message || 'Failed to delete expense.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Expense Detail</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => setIsEditing(!isEditing)}>
          <MaterialIcons name={isEditing ? 'close' : 'edit'} size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Main Expense Info Header */}
        <View style={styles.headerCard}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryEmoji}>{expense.category?.split(' ')[0] || '💸'}</Text>
          </View>
          {isEditing ? (
            <View style={{ width: '100%', gap: Spacing.sm }}>
              <TextInput
                style={styles.editInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Expense Description"
              />
              <TextInput
                style={styles.editInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Amount"
              />
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleUpdate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={Colors.onPrimary} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.expenseTitle}>{expense.title}</Text>
              <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
              <Text style={styles.expenseMeta}>
                Split Type: {expense.splitType.toUpperCase()}
              </Text>
            </>
          )}
        </View>

        {/* Split Details Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Split Breakdown</Text>
          <View style={styles.breakdownList}>
            {Object.entries(expense.splitDetails || {}).map(([memberId, share]) => (
              <View key={memberId} style={styles.breakdownRow}>
                <Text style={styles.memberName}>
                  {memberId === expense.paidBy ? `${memberId} (Paid Total)` : memberId}
                </Text>
                <Text style={styles.memberShare}>{formatCurrency(share)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
            <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
            <Text style={styles.deleteBtnText}>Delete Expense</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  headerCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  categoryBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  categoryEmoji: { fontSize: 28 },
  expenseTitle: { ...Typography.headlineLgMobile, color: Colors.onSurface, textAlign: 'center' },
  expenseAmount: { ...Typography.numericDisplay, color: Colors.primary, marginVertical: 4 },
  expenseMeta: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  editInput: {
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.gutter,
    minHeight: 48,
    ...Typography.bodyMd,
    backgroundColor: Colors.surfaceContainerLow,
    color: Colors.onSurface,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.gutter,
    minHeight: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  saveBtnText: { ...Typography.titleSm, color: Colors.onPrimary },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.titleMd, color: Colors.onBackground },
  breakdownList: { gap: Spacing.xs },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  memberName: { ...Typography.titleSm, color: Colors.onSurface },
  memberShare: { ...Typography.titleSm, color: Colors.primary, fontWeight: '600' },
  actionsRow: { marginTop: Spacing.sm },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.gutter,
    minHeight: 48,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.errorContainer,
  },
  deleteBtnText: { ...Typography.titleMd, color: Colors.error },
});
