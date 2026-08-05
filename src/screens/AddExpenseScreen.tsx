import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import { addExpenseToFirestore } from '../services/firestoreService';
import { getCurrencyConfig, formatCurrency } from '../services/currencyService';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

const CATEGORIES = ['🍕 Food', '🚕 Travel', '🏠 Rent', '🎬 Fun', '🛒 Shopping', '💊 Health', '📦 Other'];
const SPLIT_TYPES = [
  { id: 'equal', label: 'Equal' },
  { id: 'exact', label: 'By Amount' },
  { id: 'percentage', label: 'By %' },
] as const;

const MEMBERS = [
  { uid: 'user_current', name: 'You' },
  { uid: 'user_priya_101', name: 'Priya' },
  { uid: 'user_amit_102', name: 'Amit' },
  { uid: 'user_neha_103', name: 'Neha' },
];

export default function AddExpenseScreen({ navigation, route }: Props) {
  const currencyConfig = getCurrencyConfig();
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || 'user_current';

  const groupId = route.params?.groupId || 'goa_trip';

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('🍕 Food');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>('equal');
  const [paidByUserId, setPaidByUserId] = useState<string>(currentUid);
  const [submitting, setSubmitting] = useState(false);

  const activeMembers = MEMBERS.map((m) =>
    m.uid === 'user_current' ? { ...m, uid: currentUid } : m
  );

  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercentages, setCustomPercentages] = useState<Record<string, string>>({});

  const parsedAmount = parseFloat(amount) || 0;
  const numMembers = activeMembers.length;
  const perPersonEqual = parsedAmount > 0 ? parsedAmount / numMembers : 0;

  const calculateSplitDetails = (): Record<string, number> | null => {
    const details: Record<string, number> = {};

    if (splitType === 'equal') {
      activeMembers.forEach((m) => {
        details[m.uid] = Math.round(perPersonEqual * 100) / 100;
      });
      return details;
    }

    if (splitType === 'exact') {
      let sum = 0;
      for (const m of activeMembers) {
        const val = parseFloat(customAmounts[m.uid] || '0') || 0;
        details[m.uid] = val;
        sum += val;
      }
      if (Math.abs(sum - parsedAmount) > 0.05) {
        Alert.alert(
          'Split Amount Mismatch',
          `The sum of individual amounts (${formatCurrency(sum)}) must equal total expense amount (${formatCurrency(parsedAmount)}).`
        );
        return null;
      }
      return details;
    }

    if (splitType === 'percentage') {
      let pctSum = 0;
      for (const m of activeMembers) {
        const pct = parseFloat(customPercentages[m.uid] || '0') || 0;
        pctSum += pct;
        details[m.uid] = Math.round(((parsedAmount * pct) / 100) * 100) / 100;
      }
      if (Math.abs(pctSum - 100) > 0.1) {
        Alert.alert(
          'Percentage Mismatch',
          `The total percentage shares must add up to 100%. Current sum: ${pctSum.toFixed(1)}%.`
        );
        return null;
      }
      return details;
    }

    return details;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Description Required', 'Please enter an expense description (e.g. Seafood Dinner).');
      return;
    }
    if (parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount greater than 0.');
      return;
    }

    const splitDetails = calculateSplitDetails();
    if (!splitDetails) return;

    setSubmitting(true);
    try {
      await addExpenseToFirestore({
        groupId: groupId,
        title: description.trim(),
        amount: parsedAmount,
        paidBy: paidByUserId,
        splitType: splitType,
        splitDetails: splitDetails,
        category: selectedCategory,
      });

      navigation.goBack();
    } catch (error: any) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', error.message || 'Failed to save expense to Firestore.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Add Expense</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Total Amount Input Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Total Amount (INR)</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.amountCurrency}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={Colors.onPrimaryContainer}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Dinner, Taxi, Groceries"
              placeholderTextColor={Colors.outlineVariant}
            />
          </View>

          {/* Category Chips */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Paid By Picker */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Paid by</Text>
            <View style={styles.paidByRow}>
              {activeMembers.map((m) => {
                const isPaid = paidByUserId === m.uid;
                return (
                  <TouchableOpacity
                    key={m.uid}
                    style={[styles.paidChip, isPaid && styles.paidChipActive]}
                    onPress={() => setPaidByUserId(m.uid)}
                  >
                    <Text style={[styles.paidChipText, isPaid && styles.paidChipTextActive]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Split Type Selector */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Split Type</Text>
            <View style={styles.splitTypeRow}>
              {SPLIT_TYPES.map((t) => {
                const isActive = splitType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.splitBtn, isActive && styles.splitBtnActive]}
                    onPress={() => setSplitType(t.id)}
                  >
                    <Text style={[styles.splitBtnText, isActive && styles.splitBtnTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Members Split Breakdown */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Split Breakdown</Text>
            <View style={styles.membersList}>
              {activeMembers.map((m) => {
                let shareText = formatCurrency(perPersonEqual);
                if (splitType === 'exact') {
                  shareText = formatCurrency(parseFloat(customAmounts[m.uid] || '0'));
                } else if (splitType === 'percentage') {
                  const pct = parseFloat(customPercentages[m.uid] || '0');
                  shareText = `${formatCurrency((parsedAmount * pct) / 100)} (${pct}%)`;
                }

                return (
                  <View key={m.uid} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberInitial}>{m.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.memberName}>{m.name}</Text>
                    
                    {splitType === 'exact' ? (
                      <View style={styles.customInputBox}>
                        <Text style={styles.customCurrency}>₹</Text>
                        <TextInput
                          style={styles.customInput}
                          value={customAmounts[m.uid] || ''}
                          onChangeText={(val) => setCustomAmounts({ ...customAmounts, [m.uid]: val })}
                          placeholder="0"
                          keyboardType="numeric"
                        />
                      </View>
                    ) : splitType === 'percentage' ? (
                      <View style={styles.customInputBox}>
                        <TextInput
                          style={styles.customInput}
                          value={customPercentages[m.uid] || ''}
                          onChangeText={(val) => setCustomPercentages({ ...customPercentages, [m.uid]: val })}
                          placeholder="0"
                          keyboardType="numeric"
                        />
                        <Text style={styles.customCurrency}>%</Text>
                      </View>
                    ) : (
                      <Text style={styles.memberShare}>{shareText}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.disabledBtn]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Add Expense</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  amountCard: {
    backgroundColor: Colors.primaryContainer,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  amountLabel: { ...Typography.labelMd, color: Colors.onPrimaryContainer },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.xs },
  amountCurrency: { ...Typography.headlineLgMobile, color: Colors.onPrimary },
  amountInput: {
    ...Typography.numericDisplay,
    color: Colors.onPrimary,
    minWidth: 140,
    textAlign: 'center',
  },
  field: { gap: Spacing.sm },
  fieldLabel: { ...Typography.labelMd, color: Colors.onSurfaceVariant },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 48,
    ...Typography.bodyMd,
    color: Colors.onSurface,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  chipsRow: { gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceContainer,
  },
  chipActive: { backgroundColor: Colors.primaryFixed, borderColor: Colors.primary, borderWidth: 1 },
  chipText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  chipTextActive: { color: Colors.primary, fontWeight: '600' },
  paidByRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  paidChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
  },
  paidChipActive: { backgroundColor: Colors.primary },
  paidChipText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  paidChipTextActive: { color: Colors.onPrimary, fontWeight: '600' },
  splitTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  splitBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    minHeight: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitBtnActive: { backgroundColor: Colors.primary },
  splitBtnText: { ...Typography.titleSm, color: Colors.onSurfaceVariant },
  splitBtnTextActive: { color: Colors.onPrimary, fontWeight: '600' },
  membersList: { gap: Spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: { ...Typography.titleSm, color: Colors.primary },
  memberName: { ...Typography.bodyLg, color: Colors.onSurface, flex: 1 },
  memberShare: { ...Typography.titleMd, color: Colors.primary, fontWeight: '600' },
  customInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.surfaceContainerLowest,
    minWidth: 80,
  },
  customCurrency: { fontSize: 14, color: Colors.onSurfaceVariant },
  customInput: { fontSize: 14, color: Colors.onSurface, minWidth: 40, textAlign: 'center' },
  submitBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  disabledBtn: { opacity: 0.6 },
  submitBtnText: { ...Typography.titleMd, color: Colors.onPrimary },
});
