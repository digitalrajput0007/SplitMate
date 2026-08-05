import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { formatCurrency } from '../services/currencyService';
import { useTheme } from '../context/ThemeContext';
import {
  deleteExpenseFromFirestore,
  ExpenseData,
} from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

export default function ExpenseDetailScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const [expense, setExpense] = useState<ExpenseData>(route.params?.expense);

  // Update local expense state if navigation params change (e.g. after edit)
  useEffect(() => {
    if (route.params?.expense) {
      setExpense(route.params.expense);
    }
  }, [route.params?.expense]);

  if (!expense) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Expense Details</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>
    );
  }

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

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const DetailSection = ({ label, value, icon, isEmoji = false }: { label: string; value: string; icon: string; isEmoji?: boolean }) => (
    <View style={[styles.detailRow, { borderBottomColor: colors.outlineVariant }]}>
      <View style={styles.detailLabelContainer}>
        {isEmoji ? (
          <Text style={styles.emojiIcon}>{icon}</Text>
        ) : (
          <MaterialIcons name={icon as any} size={20} color={colors.onSurfaceVariant} />
        )}
        <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: colors.onSurface }]}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Expense Detail</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('EditExpense', { expense })}
        >
          <MaterialIcons name="edit" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={[styles.heroCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
          <View style={[styles.categoryBadge, { backgroundColor: colors.primaryFixed }]}>
            <Text style={styles.categoryEmoji}>{expense.category?.split(' ')[0] || '💸'}</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.onSurface }]}>{expense.title}</Text>
          <Text style={[styles.heroAmount, { color: colors.primary }]}>{formatCurrency(expense.amount)}</Text>
        </View>

        {/* Detailed Sections */}
        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
          <DetailSection label="Description" value={expense.title} icon="description" />
          <DetailSection label="Amount" value={formatCurrency(expense.amount)} icon="payments" />
          <DetailSection label="Paid By" value={expense.paidByName || expense.paidBy} icon="person" />
          <DetailSection label="Group" value={expense.groupName || 'Unassigned'} icon="group" />
          <DetailSection label="Category" value={expense.category} icon="category" />
          <DetailSection label="Expense Date" value={formatDate(expense.createdAt)} icon="event" />
          <DetailSection label="Split Type" value={expense.splitType.toUpperCase()} icon="call-split" />
          <DetailSection label="Created Date" value={formatDate(expense.createdAt)} icon="history" />
        </View>

        {/* Documentation Section */}
        <View style={[styles.infoCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
          <View style={styles.docSection}>
            <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>Notes</Text>
            <Text style={[styles.docText, { color: expense.notes ? colors.onSurface : colors.outline }]}>
              {expense.notes || 'No notes added'}
            </Text>
          </View>
          <View style={[styles.docSection, { borderTopWidth: 1, borderTopColor: colors.outlineVariant }]}>
            <Text style={[styles.sectionHeader, { color: colors.onSurfaceVariant }]}>Receipt</Text>
            {expense.receiptUrl ? (
              <Text style={[styles.docText, { color: colors.primary }]}>Receipt attached (view)</Text>
            ) : (
              <Text style={[styles.docText, { color: colors.outline }]}>No receipt attached</Text>
            )}
          </View>
        </View>

        {/* Split Breakdown */}
        <View style={styles.breakdownSection}>
          <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Split Breakdown</Text>
          <View style={[styles.breakdownList, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
            {Object.entries(expense.splitDetails || {}).map(([memberId, share], index) => (
              <View
                key={memberId}
                style={[
                  styles.breakdownRow,
                  index !== 0 && { borderTopWidth: 1, borderTopColor: colors.outlineVariant }
                ]}
              >
                <View style={styles.memberInfo}>
                  <View style={[styles.avatarMini, { backgroundColor: colors.primaryFixed }]}>
                    <Text style={[styles.avatarInitial, { color: colors.primary }]}>{memberId.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.memberName, { color: colors.onSurface }]}>
                    {memberId === expense.paidBy ? `${memberId} (Payer)` : memberId}
                  </Text>
                </View>
                <Text style={[styles.memberShare, { color: colors.primary }]}>{formatCurrency(share)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: colors.error, backgroundColor: colors.surfaceContainerLowest }]}
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <MaterialIcons name="delete-outline" size={20} color={colors.error} />
            <Text style={[styles.deleteBtnText, { color: colors.error }]}>Delete Expense</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.card,
    borderWidth: 1,
  },
  categoryBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  categoryEmoji: { fontSize: 32 },
  heroTitle: { ...Typography.headlineLgMobile, textAlign: 'center' },
  heroAmount: { ...Typography.numericDisplay, fontSize: 32, marginVertical: 4 },
  infoCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadows.card,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  detailLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailLabel: { ...Typography.labelMd, fontWeight: '500' },
  detailValue: { ...Typography.bodyMd, fontWeight: '600', flex: 1, textAlign: 'right' },
  emojiIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  docSection: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  sectionHeader: { ...Typography.labelMd, textTransform: 'uppercase', letterSpacing: 0.5 },
  docText: { ...Typography.bodyMd },
  breakdownSection: { gap: Spacing.md },
  sectionTitle: { ...Typography.titleMd, fontWeight: '700' },
  breakdownList: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Shadows.card,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { ...Typography.labelMd, fontWeight: '700' },
  memberName: { ...Typography.bodyMd, fontWeight: '500' },
  memberShare: { ...Typography.titleSm, fontWeight: '700' },
  actionsContainer: { marginTop: Spacing.md },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  deleteBtnText: { ...Typography.titleMd, fontWeight: '600' },
});
