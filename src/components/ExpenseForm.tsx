import React, { useState, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { formatCurrency } from '../services/currencyService';
import { useTheme } from '../context/ThemeContext';

export interface Member {
  uid: string;
  name: string;
}

export interface ExpenseFormData {
  title: string;
  amount: number;
  paidBy: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splitDetails: Record<string, number>;
  category: string;
}

export interface ExpenseFormHandle {
  getFormData: () => { data: ExpenseFormData | null; error?: string };
}

interface Props {
  members: Member[];
  initialData?: Partial<ExpenseFormData>;
  currentUid: string;
  selectedMemberUids: string[];
  onSelectedMembersChange: (uids: string[]) => void;
}

const CATEGORIES = ['🍕 Food', '🚕 Travel', '🏠 Rent', '🎬 Fun', '🛒 Shopping', '💊 Health', '📦 Other'];
const SPLIT_TYPES = [
  { id: 'equal', label: 'Equal' },
  { id: 'exact', label: 'By Amount' },
  { id: 'percentage', label: 'By %' },
] as const;

export const ExpenseForm = forwardRef<ExpenseFormHandle, Props>(({
  members,
  initialData,
  currentUid,
  selectedMemberUids,
  onSelectedMembersChange
}, ref) => {
  const { colors } = useTheme();

  const [description, setDescription] = useState(initialData?.title || '');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [selectedCategory, setSelectedCategory] = useState(initialData?.category || '🍕 Food');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>(initialData?.splitType || 'equal');
  const [paidByUserId, setPaidByUserId] = useState<string>(initialData?.paidBy || currentUid);

  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercentages, setCustomPercentages] = useState<Record<string, string>>({});

  const parsedAmount = parseFloat(amount) || 0;
  const selectedMembersCount = selectedMemberUids.length;
  const perPersonEqual = (parsedAmount > 0 && selectedMembersCount > 0) ? parsedAmount / selectedMembersCount : 0;

  const toggleMemberSelection = (uid: string) => {
    if (selectedMemberUids.includes(uid)) {
      onSelectedMembersChange(selectedMemberUids.filter((id) => id !== uid));
    } else {
      onSelectedMembersChange([...selectedMemberUids, uid]);
    }
  };

  const calculateSplitDetails = (): { data: Record<string, number> | null; error?: string } => {
    const details: Record<string, number> = {};

    if (selectedMembersCount === 0) {
      return { data: null, error: 'At least one member must be selected for the split.' };
    }

    if (splitType === 'equal') {
      members.forEach((m) => {
        if (selectedMemberUids.includes(m.uid)) {
          details[m.uid] = Math.round(perPersonEqual * 100) / 100;
        } else {
          details[m.uid] = 0;
        }
      });
      return { data: details };
    }

    if (splitType === 'exact') {
      let sum = 0;
      for (const m of members) {
        if (selectedMemberUids.includes(m.uid)) {
          const val = parseFloat(customAmounts[m.uid] || '0') || 0;
          details[m.uid] = val;
          sum += val;
        } else {
          details[m.uid] = 0;
        }
      }
      if (Math.abs(sum - parsedAmount) > 0.05) {
        return {
          data: null,
          error: `Split Amount Mismatch: Sum (${formatCurrency(sum)}) must equal total (${formatCurrency(parsedAmount)}).`
        };
      }
      return { data: details };
    }

    if (splitType === 'percentage') {
      let pctSum = 0;
      for (const m of members) {
        if (selectedMemberUids.includes(m.uid)) {
          const pct = parseFloat(customPercentages[m.uid] || '0') || 0;
          pctSum += pct;
          details[m.uid] = Math.round(((parsedAmount * pct) / 100) * 100) / 100;
        } else {
          details[m.uid] = 0;
        }
      }
      if (Math.abs(pctSum - 100) > 0.1) {
        return {
          data: null,
          error: `Percentage Mismatch: Total must add up to 100%. Current: ${pctSum.toFixed(1)}%.`
        };
      }
      return { data: details };
    }

    return { data: details };
  };

  useImperativeHandle(ref, () => ({
    getFormData: () => {
      if (!description.trim()) {
        return { data: null, error: 'Please enter an expense description.' };
      }
      if (parsedAmount <= 0) {
        return { data: null, error: 'Please enter a valid expense amount.' };
      }

      const { data: splitDetails, error } = calculateSplitDetails();
      if (error) return { data: null, error };

      return {
        data: {
          title: description.trim(),
          amount: parsedAmount,
          paidBy: paidByUserId,
          splitType,
          splitDetails: splitDetails || {},
          category: selectedCategory,
        }
      };
    },
  }));

  return (
    <View style={styles.formContainer}>
      {/* Total Amount Input Card */}
      <View style={[styles.amountCard, { backgroundColor: colors.primaryContainer }]}>
        <Text style={[styles.amountLabel, { color: colors.onPrimaryContainer }]}>Total Amount (INR)</Text>
        <View style={styles.amountInputRow}>
          <Text style={[styles.amountCurrency, { color: colors.onPrimary }]}>₹</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.onPrimary }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.onPrimaryContainer}
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Description */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Description</Text>
        <TextInput
          style={[styles.textInput, {
            borderColor: colors.outlineVariant,
            color: colors.onSurface,
            backgroundColor: colors.surfaceContainerLowest
          }]}
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Dinner, Taxi, Groceries"
          placeholderTextColor={colors.outline}
        />
      </View>

      {/* Category Chips */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.chip,
                { backgroundColor: colors.surfaceContainer },
                selectedCategory === cat && [styles.chipActive, { backgroundColor: colors.primaryFixed, borderColor: colors.primary }]
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[
                styles.chipText,
                { color: colors.onSurfaceVariant },
                selectedCategory === cat && { color: colors.primary, fontWeight: '600' }
              ]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Paid By Picker */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Paid by</Text>
        <View style={styles.paidByRow}>
          {members.map((m) => {
            const isPaid = paidByUserId === m.uid;
            return (
              <TouchableOpacity
                key={m.uid}
                style={[
                  styles.paidChip,
                  { backgroundColor: colors.surfaceContainer },
                  isPaid && { backgroundColor: colors.primary }
                ]}
                onPress={() => setPaidByUserId(m.uid)}
              >
                <Text style={[
                  styles.paidChipText,
                  { color: colors.onSurfaceVariant },
                  isPaid && { color: colors.onPrimary, fontWeight: '600' }
                ]}>
                  {m.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Split Type Selector */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Split Type</Text>
        <View style={styles.splitTypeRow}>
          {SPLIT_TYPES.map((t) => {
            const isActive = splitType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.splitBtn,
                  { backgroundColor: colors.surfaceContainer },
                  isActive && { backgroundColor: colors.primary }
                ]}
                onPress={() => setSplitType(t.id)}
              >
                <Text style={[
                  styles.splitBtnText,
                  { color: colors.onSurfaceVariant },
                  isActive && { color: colors.onPrimary, fontWeight: '600' }
                ]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Members Split Breakdown */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Split Breakdown</Text>
        <View style={styles.membersList}>
          {members.map((m) => {
            const isSelected = selectedMemberUids.includes(m.uid);
            let shareText = formatCurrency(perPersonEqual);

            if (!isSelected) {
              shareText = 'Excluded';
            } else if (splitType === 'exact') {
              shareText = formatCurrency(parseFloat(customAmounts[m.uid] || '0'));
            } else if (splitType === 'percentage') {
              const pct = parseFloat(customPercentages[m.uid] || '0');
              shareText = `${formatCurrency((parsedAmount * pct) / 100)} (${pct}%)`;
            }

            return (
              <TouchableOpacity
                key={m.uid}
                activeOpacity={0.7}
                onPress={() => toggleMemberSelection(m.uid)}
                style={[
                  styles.memberRow,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: isSelected ? colors.primary : colors.outlineVariant,
                    opacity: isSelected ? 1 : 0.6,
                  }
                ]}
              >
                <View style={[styles.memberAvatar, { backgroundColor: isSelected ? colors.primaryFixed : colors.surfaceContainer }]}>
                  {isSelected ? (
                    <Text style={[styles.memberInitial, { color: colors.primary }]}>{m.name.charAt(0).toUpperCase()}</Text>
                  ) : (
                    <MaterialIcons name="person-off" size={20} color={colors.outline} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: isSelected ? colors.onSurface : colors.outline }]}>
                    {m.name}
                  </Text>
                  {!isSelected && <Text style={{ fontSize: 10, color: colors.outline }}>Tap to include</Text>}
                </View>

                {isSelected && (
                  <>
                    {splitType === 'exact' ? (
                      <View style={[styles.customInputBox, {
                        borderColor: colors.outlineVariant,
                        backgroundColor: colors.surfaceContainerLowest
                      }]}>
                        <Text style={[styles.customCurrency, { color: colors.onSurfaceVariant }]}>₹</Text>
                        <TextInput
                          style={[styles.customInput, { color: colors.onSurface }]}
                          value={customAmounts[m.uid] || ''}
                          onChangeText={(val) => setCustomAmounts({ ...customAmounts, [m.uid]: val })}
                          placeholder="0"
                          placeholderTextColor={colors.outline}
                          keyboardType="numeric"
                        />
                      </View>
                    ) : splitType === 'percentage' ? (
                      <View style={[styles.customInputBox, {
                        borderColor: colors.outlineVariant,
                        backgroundColor: colors.surfaceContainerLowest
                      }]}>
                        <TextInput
                          style={[styles.customInput, { color: colors.onSurface }]}
                          value={customPercentages[m.uid] || ''}
                          onChangeText={(val) => setCustomPercentages({ ...customPercentages, [m.uid]: val })}
                          placeholder="0"
                          placeholderTextColor={colors.outline}
                          keyboardType="numeric"
                        />
                        <Text style={[styles.customCurrency, { color: colors.onSurfaceVariant }]}>%</Text>
                      </View>
                    ) : (
                      <Text style={[styles.memberShare, { color: colors.primary }]}>{shareText}</Text>
                    )}
                  </>
                )}

                <MaterialIcons
                  name={isSelected ? "check-circle" : "radio-button-unchecked"}
                  size={24}
                  color={isSelected ? colors.primary : colors.outline}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  formContainer: { gap: Spacing.lg },
  amountCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  amountLabel: { ...Typography.labelMd },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  amountCurrency: { ...Typography.headlineLgMobile },
  amountInput: {
    ...Typography.numericDisplay,
    minWidth: 140,
    textAlign: 'center',
  },
  field: { gap: Spacing.sm },
  fieldLabel: { ...Typography.labelMd },
  textInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: 48,
    ...Typography.bodyMd,
  },
  chipsRow: { gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  chipActive: { borderWidth: 1 },
  chipText: { ...Typography.bodyMd },
  paidByRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  paidChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
  paidChipText: { ...Typography.bodyMd },
  splitTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  splitBtn: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    minHeight: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitBtnText: { ...Typography.titleSm },
  membersList: { gap: Spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.card,
    borderWidth: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitial: { ...Typography.titleSm },
  memberName: { ...Typography.bodyLg, flex: 1 },
  memberShare: { ...Typography.titleMd, fontWeight: '600' },
  customInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 80,
  },
  customCurrency: { fontSize: 14 },
  customInput: { fontSize: 14, minWidth: 40, textAlign: 'center' },
});
