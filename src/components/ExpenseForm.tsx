import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../services/currencyService';
import { Image } from 'react-native';

export interface ExpenseFormData {
  title: string;
  amount: number;
  paidBy: string;
  splitType: 'equal' | 'exact' | 'percentage';
  splitDetails: Record<string, number>;
  category: string;
  date?: string;
  notes?: string;
  receiptUrl?: string;
}

interface Member {
  uid: string;
  name: string;
}

interface ExpenseFormProps {
  members: Member[];
  initialData?: Partial<ExpenseFormData>;
  onSubmit: (data: ExpenseFormData) => void;
  submitting?: boolean;
  submitLabel?: string;
}

export const CATEGORIES = ['🍕 Food', '🚕 Travel', '🏠 Rent', '🎬 Fun', '🛒 Shopping', '💊 Health', '📦 Other'];
const SPLIT_TYPES = [
  { id: 'equal', label: 'Equal' },
  { id: 'exact', label: 'By Amount' },
  { id: 'percentage', label: 'By %' },
] as const;

export default function ExpenseForm({
  members,
  initialData,
  onSubmit,
  submitting = false,
  submitLabel = 'Save Expense',
}: ExpenseFormProps) {
  const { colors } = useTheme();

  const [description, setDescription] = useState(initialData?.title || '');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [selectedCategory, setSelectedCategory] = useState(initialData?.category || '🍕 Food');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>(initialData?.splitType || 'equal');
  const [paidByUserId, setPaidByUserId] = useState<string>(initialData?.paidBy || members[0]?.uid || '');
  const [date, setDate] = useState<Date>(initialData?.date ? new Date(initialData.date) : new Date());
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [receiptImage, setReceiptImage] = useState<string | null>(initialData?.receiptUrl || null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercentages, setCustomPercentages] = useState<Record<string, string>>({});

  const handlePickReceipt = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to attach a receipt.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setReceiptImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Receipt pick error:', error);
      Alert.alert('Error', 'Could not select photo');
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptImage(null);
  };

  const parsedAmount = parseFloat(amount) || 0;
  const numMembers = members.length;
  const perPersonEqual = parsedAmount > 0 ? parsedAmount / numMembers : 0;

  const calculateSplitDetails = (): Record<string, number> | null => {
    const details: Record<string, number> = {};

    if (splitType === 'equal') {
      members.forEach((m) => {
        details[m.uid] = Math.round(perPersonEqual * 100) / 100;
      });
      return details;
    }

    if (splitType === 'exact') {
      let sum = 0;
      for (const m of members) {
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
      for (const m of members) {
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

  const handlePressSubmit = () => {
    if (!description.trim()) {
      Alert.alert('Description Required', 'Please enter an expense description.');
      return;
    }
    if (parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    const splitDetails = calculateSplitDetails();
    if (!splitDetails) return;

    const data: ExpenseFormData = {
      title: description.trim(),
      amount: parsedAmount,
      paidBy: paidByUserId,
      splitType,
      splitDetails,
      category: selectedCategory,
      date: date.toISOString(),
      notes: notes.trim(),
      receiptUrl: receiptImage || '', // Use empty string instead of undefined
    };

    onSubmit(data);
  };

  const formatDateShort = (d: Date) => {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {/* Amount Input */}
      <View style={[styles.amountCard, { backgroundColor: colors.primaryContainer }]}>
        <Text style={[styles.amountLabel, { color: colors.onPrimaryContainer }]}>Total Amount</Text>
        <View style={styles.amountInputRow}>
          <Text style={[styles.amountCurrency, { color: colors.onPrimary }]}>₹</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.onPrimary }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="rgba(255,255,255,0.5)"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      {/* Description */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Description</Text>
        <TextInput
          style={[styles.textInput, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface }]}
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
                selectedCategory === cat && { backgroundColor: colors.primaryFixed, borderColor: colors.primary, borderWidth: 1 }
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.chipText, { color: colors.onSurfaceVariant }, selectedCategory === cat && { color: colors.primary, fontWeight: '600' }]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Paid By */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Paid by</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
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
                <Text style={[styles.paidChipText, { color: colors.onSurfaceVariant }, isPaid && { color: colors.onPrimary, fontWeight: '600' }]}>
                  {m.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Split Type */}
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
                <Text style={[styles.splitBtnText, { color: colors.onSurfaceVariant }, isActive && { color: colors.onPrimary, fontWeight: '600' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Breakdown */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Split Breakdown</Text>
        <View style={styles.membersList}>
          {members.map((m) => {
            let shareText = formatCurrency(perPersonEqual);
            if (splitType === 'exact') {
              shareText = formatCurrency(parseFloat(customAmounts[m.uid] || '0'));
            } else if (splitType === 'percentage') {
              const pct = parseFloat(customPercentages[m.uid] || '0');
              shareText = `${formatCurrency((parsedAmount * pct) / 100)} (${pct}%)`;
            }

            return (
              <View key={m.uid} style={[styles.memberRow, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                <View style={[styles.memberAvatar, { backgroundColor: colors.primaryFixed }]}>
                  <Text style={[styles.memberInitial, { color: colors.primary }]}>{m.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.memberName, { color: colors.onSurface }]}>{m.name}</Text>

                {splitType === 'exact' ? (
                  <View style={[styles.customInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
                    <Text style={[styles.customCurrency, { color: colors.onSurfaceVariant }]}>₹</Text>
                    <TextInput
                      style={[styles.customInput, { color: colors.onSurface }]}
                      value={customAmounts[m.uid] || ''}
                      onChangeText={(val) => setCustomAmounts({ ...customAmounts, [m.uid]: val })}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                ) : splitType === 'percentage' ? (
                  <View style={[styles.customInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
                    <TextInput
                      style={[styles.customInput, { color: colors.onSurface }]}
                      value={customPercentages[m.uid] || ''}
                      onChangeText={(val) => setCustomPercentages({ ...customPercentages, [m.uid]: val })}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                    <Text style={[styles.customCurrency, { color: colors.onSurfaceVariant }]}>%</Text>
                  </View>
                ) : (
                  <Text style={[styles.memberShare, { color: colors.primary }]}>{shareText}</Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Date Picker */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Date</Text>
        <TouchableOpacity
          style={[styles.textInput, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={{ color: colors.onSurface }}>{formatDateShort(date)}</Text>
          <MaterialIcons name="calendar-today" size={20} color={colors.primary} />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setDate(selectedDate);
            }}
          />
        )}
      </View>

      {/* Notes */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Notes (Optional)</Text>
        <TextInput
          style={[styles.textInput, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest, color: colors.onSurface, minHeight: 80, textAlignVertical: 'top' }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add extra details here..."
          placeholderTextColor={colors.outline}
          multiline
        />
      </View>

      {/* Receipt */}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Receipt (Optional)</Text>
        {receiptImage ? (
          <View style={styles.receiptContainer}>
            <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
            <TouchableOpacity
              style={[styles.removeReceiptBtn, { backgroundColor: colors.error }]}
              onPress={handleRemoveReceipt}
            >
              <MaterialIcons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.receiptPlaceholder, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, borderStyle: 'dashed' }]}
            onPress={handlePickReceipt}
          >
            <MaterialIcons name="photo-camera" size={24} color={colors.primary} />
            <Text style={{ color: colors.onSurfaceVariant, marginTop: 4, ...Typography.labelMd }}>Add Receipt Image</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: colors.primary }, submitting && { opacity: 0.6 }]}
        onPress={handlePressSubmit}
        activeOpacity={0.85}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} size="small" />
        ) : (
          <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>{submitLabel}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: { flex: 1 },
  amountCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  amountLabel: { ...Typography.labelMd },
  amountInputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amountCurrency: { ...Typography.headlineLg, fontWeight: '700' },
  amountInput: {
    ...Typography.numericDisplay,
    minWidth: 120,
    textAlign: 'center',
  },
  field: { gap: Spacing.sm, marginBottom: Spacing.lg },
  fieldLabel: { ...Typography.labelMd, fontWeight: '600' },
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
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  chipText: { ...Typography.bodyMd },
  paidChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  paidChipText: { ...Typography.bodyMd },
  splitTypeRow: { flexDirection: 'row', gap: Spacing.sm },
  splitBtn: {
    flex: 1,
    paddingVertical: 10,
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
  memberInitial: { ...Typography.titleSm, fontWeight: '700' },
  memberName: { ...Typography.bodyLg, flex: 1 },
  memberShare: { ...Typography.titleMd, fontWeight: '700' },
  customInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 80,
  },
  customCurrency: { fontSize: 14, fontWeight: '600' },
  customInput: { fontSize: 14, minWidth: 40, textAlign: 'center' },
  receiptPlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  receiptPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeReceiptBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  submitBtn: {
    width: '100%',
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    ...Shadows.button,
  },
  submitBtnText: { ...Typography.titleMd, fontWeight: '700' },
});
