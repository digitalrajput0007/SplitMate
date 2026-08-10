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
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../services/currencyService';
import { Image } from 'react-native';
import { SmartImage } from './SmartImage';
import { ImagePreviewModal } from './ImagePreviewModal';

import { Switch } from 'react-native';

export interface RecurringConfig {
  isRecurring: boolean;
  frequency: 'weekly' | 'monthly' | 'yearly';
  startDate: string; // 'YYYY-MM-DD'
  endDate: string | null; // 'YYYY-MM-DD' | null
}

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
  recurringConfig?: RecurringConfig;
}

interface Member {
  uid: string;
  name: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
}

interface ExpenseFormProps {
  members: Member[];
  initialData?: Partial<ExpenseFormData>;
  onPickReceipt: () => void;
  onRemoveReceipt: () => void;
  onSubmit: (data: ExpenseFormData) => void;
  submitting?: boolean;
  submitLabel?: string;
  isUploading?: boolean;
  progress?: number;
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
  onPickReceipt,
  onRemoveReceipt,
  onSubmit,
  submitting = false,
  submitLabel = 'Save Expense',
  isUploading = false,
  progress = 0,
}: ExpenseFormProps) {
  const { colors } = useTheme();

  const [description, setDescription] = useState(initialData?.title || '');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [displayAmount, setDisplayAmount] = useState('');

  useEffect(() => {
    if (initialData?.amount) {
      handleAmountChange(initialData.amount.toString());
    }
  }, [initialData?.amount]);

  const handleAmountChange = (text: string) => {
    // Remove everything except numbers and one decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');
    const parts = cleanText.split('.');

    // Prevent multiple decimal points
    if (parts.length > 2) return;

    // Limit decimal places to 2
    if (parts[1] && parts[1].length > 2) {
      parts[1] = parts[1].slice(0, 2);
    }

    const rawValue = parts.join('.');
    setAmount(rawValue);

    // If in "Exact" mode, we should probably clear custom amounts as the total changed
    if (splitType === 'exact') {
      setCustomAmounts({});
    }

    // Format for display with separators (Indian style if possible, or standard)
    if (rawValue === '') {
      setDisplayAmount('');
      return;
    }

    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';

    // Indian formatting logic: Last 3 digits grouped, then groups of 2
    // e.g. 12,34,567
    if (integerPart.length > 3) {
      let lastThree = integerPart.substring(integerPart.length - 3);
      let otherParts = integerPart.substring(0, integerPart.length - 3);
      if (otherParts !== '') {
        otherParts = otherParts.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
        integerPart = otherParts + ',' + lastThree;
      }
    }

    setDisplayAmount(integerPart + decimalPart);
  };

  const [selectedCategory, setSelectedCategory] = useState(initialData?.category || '🍕 Food');
  const [splitType, setSplitType] = useState<'equal' | 'exact' | 'percentage'>(initialData?.splitType || 'equal');
  const [paidByUserId, setPaidByUserId] = useState<string>(initialData?.paidBy || members[0]?.uid || '');
  const [date, setDate] = useState<Date>(initialData?.date ? new Date(initialData.date) : new Date());
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState<Date>(initialData?.date ? new Date(initialData.date) : new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercentages, setCustomPercentages] = useState<Record<string, string>>({});
  const [manuallyEdited, setManuallyEdited] = useState<Set<string>>(new Set());

  const handleCustomAmountChange = (uid: string, val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, '');
    const updated = { ...customAmounts, [uid]: cleanVal };
    const newEdited = new Set(manuallyEdited).add(uid);
    setManuallyEdited(newEdited);

    // Auto-calculate for the "remaining" person
    // Remaining person is the only one NOT in newEdited, OR the last one in members list if all are in newEdited
    const notEdited = members.filter(m => !newEdited.has(m.uid));

    if (notEdited.length === 1 && cleanVal !== '' && parsedAmount > 0) {
      const targetUid = notEdited[0].uid;
      const othersSum = members
        .filter(m => m.uid !== targetUid)
        .reduce((acc, m) => acc + (parseFloat(updated[m.uid] || '0') || 0), 0);

      const remaining = Math.max(0, parsedAmount - othersSum);
      updated[targetUid] = remaining.toFixed(2).replace(/\.00$/, '');
    }
    setCustomAmounts(updated);
  };

  const handleCustomPercentageChange = (uid: string, val: string) => {
    const cleanVal = val.replace(/[^0-9.]/g, '');
    const updated = { ...customPercentages, [uid]: cleanVal };
    const newEdited = new Set(manuallyEdited).add(uid);
    setManuallyEdited(newEdited);

    // Auto-calculate for the "remaining" person
    const notEdited = members.filter(m => !newEdited.has(m.uid));

    if (notEdited.length === 1 && cleanVal !== '') {
      const targetUid = notEdited[0].uid;
      const othersSum = members
        .filter(m => m.uid !== targetUid)
        .reduce((acc, m) => acc + (parseFloat(updated[m.uid] || '0') || 0), 0);

      const remaining = Math.max(0, 100 - othersSum);
      updated[targetUid] = remaining.toFixed(2).replace(/\.00$/, '');
    }
    setCustomPercentages(updated);
  };

  const handlePickReceipt = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to attach a receipt.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onPickReceipt(); // This trigger the parent hook
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

  const handleSplitTypeChange = (type: 'equal' | 'exact' | 'percentage') => {
    setSplitType(type);
    setManuallyEdited(new Set());
  };

  const calculateSplitDetails = (): Record<string, number> | null => {
    const details: Record<string, number> = {};

    if (splitType === 'equal') {
      const share = Math.floor((parsedAmount / numMembers) * 100) / 100;
      const remainder = Math.round((parsedAmount - (share * numMembers)) * 100) / 100;

      members.forEach((m, idx) => {
        // Distribute remainder to the first person
        details[m.uid] = idx === 0 ? Math.round((share + remainder) * 100) / 100 : share;
      });
      return details;
    }

    if (splitType === 'exact') {
      let sum = 0;
      for (const m of members) {
        const val = parseFloat(customAmounts[m.uid] || '0') || 0;
        details[m.uid] = Math.round(val * 100) / 100;
        sum += details[m.uid];
      }
      if (Math.abs(sum - parsedAmount) > 0.01) {
        Alert.alert(
          'Split Amount Mismatch',
          `The sum of individual amounts (${formatCurrency(sum)}) must equal total expense amount (${formatCurrency(parsedAmount)}). Difference: ${formatCurrency(Math.abs(sum - parsedAmount))}`
        );
        return null;
      }
      return details;
    }

    if (splitType === 'percentage') {
      let pctSum = 0;
      let calculatedSum = 0;

      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        const pct = parseFloat(customPercentages[m.uid] || '0') || 0;
        pctSum += pct;

        if (i === members.length - 1) {
          // Last person gets the remaining balance to ensure total matches exactly
          details[m.uid] = Math.round((parsedAmount - calculatedSum) * 100) / 100;
        } else {
          const share = Math.round(((parsedAmount * pct) / 100) * 100) / 100;
          details[m.uid] = share;
          calculatedSum += share;
        }
      }

      if (Math.abs(pctSum - 100) > 0.01) {
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

    const formatDateStr = (d: Date): string => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const data: ExpenseFormData = {
      title: description.trim(),
      amount: parsedAmount,
      paidBy: paidByUserId,
      splitType,
      splitDetails,
      category: selectedCategory,
      date: date.toISOString(),
      notes: notes.trim(),
      receiptUrl: initialData?.receiptUrl || '',
      recurringConfig: isRecurring
        ? {
            isRecurring: true,
            frequency,
            startDate: formatDateStr(startDate),
            endDate: endDate ? formatDateStr(endDate) : null,
          }
        : undefined,
    };

    onSubmit(data);
  };

  const formatDateShort = (d: Date) => {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <ScrollView
      style={[styles.form, { backgroundColor: colors.background }]}
      contentContainerStyle={{ backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Amount Input */}
      <View style={[styles.amountCard, { backgroundColor: colors.primaryContainer }]}>
        <Text style={[styles.amountLabel, { color: colors.onPrimaryContainer }]}>Total Amount</Text>
        <View style={styles.amountInputRow}>
          <Text style={[styles.amountCurrency, { color: colors.onPrimary }]}>₹</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.onPrimary }]}
            value={displayAmount}
            onChangeText={handleAmountChange}
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="decimal-pad"
            autoFocus={!initialData?.amount}
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
                onPress={() => handleSplitTypeChange(t.id)}
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
              const share = Math.round(((parsedAmount * pct) / 100) * 100) / 100;
              shareText = `${formatCurrency(share)} (${pct}%)`;
            }

            return (
              <View key={m.uid} style={[styles.memberRow, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
                <SmartImage
                  uri={m.photoUrl}
                  thumbnailUri={m.photoThumbnailUrl}
                  size={40}
                  mode="thumbnail"
                  fallbackIcon="person"
                  style={styles.memberAvatar}
                />
                <Text style={[styles.memberName, { color: colors.onSurface }]}>{m.name}</Text>

                {splitType === 'exact' ? (
                  <View style={[styles.customInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
                    <Text style={[styles.customCurrency, { color: colors.onSurfaceVariant }]}>₹</Text>
                    <TextInput
                      style={[styles.customInput, { color: colors.onSurface }]}
                      value={customAmounts[m.uid] || ''}
                      onChangeText={(val) => handleCustomAmountChange(m.uid, val)}
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                ) : splitType === 'percentage' ? (
                  <View style={[styles.customInputBox, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLowest }]}>
                    <TextInput
                      style={[styles.customInput, { color: colors.onSurface }]}
                      value={customPercentages[m.uid] || ''}
                      onChangeText={(val) => handleCustomPercentageChange(m.uid, val)}
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
        {isUploading ? (
          <View style={[styles.receiptPlaceholder, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.primary, borderWidth: 1.5 }]}>
            <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: 6 }} />
            <Text style={{ color: colors.primary, fontWeight: '600', ...Typography.labelMd }}>
              Uploading Receipt... {progress}%
            </Text>
            <View style={{ width: '80%', height: 4, borderRadius: 2, backgroundColor: colors.outlineVariant, marginTop: 8, overflow: 'hidden' }}>
              <View style={{ width: `${progress}%`, height: '100%', backgroundColor: colors.primary }} />
            </View>
          </View>
        ) : initialData?.receiptUrl ? (
          <View style={styles.receiptContainer}>
            <TouchableOpacity onPress={() => setShowImagePreview(true)} activeOpacity={0.9} style={{ flex: 1 }}>
              <Image source={{ uri: initialData.receiptUrl }} style={styles.receiptPreview} />
              <View style={[styles.previewBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <MaterialIcons name="fullscreen" size={16} color="#FFF" />
                <Text style={styles.previewText}>Preview</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.removeReceiptBtn, { backgroundColor: colors.error }]}
              onPress={onRemoveReceipt}
            >
              <MaterialIcons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.receiptPlaceholder, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, borderStyle: 'dashed' }]}
            onPress={onPickReceipt}
          >
            <MaterialIcons name="photo-camera" size={24} color={colors.primary} />
            <Text style={{ color: colors.onSurfaceVariant, marginTop: 4, ...Typography.labelMd }}>Add Receipt Image</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recurring Expense Section */}
      <View style={[styles.field, styles.recurringCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
        <View style={styles.recurringRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.recurringTitle, { color: colors.onSurface }]}>Make this a recurring expense</Text>
            <Text style={[styles.recurringSub, { color: colors.onSurfaceVariant }]}>
              Automatically create future expenses on schedule
            </Text>
          </View>
          <Switch
            value={isRecurring}
            onValueChange={setIsRecurring}
            trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
            thumbColor={isRecurring ? colors.primary : colors.outline}
          />
        </View>

        {isRecurring && (
          <View style={styles.recurringConfigSection}>
            <View style={[styles.recurringDivider, { backgroundColor: colors.divider }]} />

            {/* Frequency Pills */}
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant, marginTop: 4 }]}>Repeat Frequency</Text>
            <View style={styles.frequencyRow}>
              {(['weekly', 'monthly', 'yearly'] as const).map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.freqPill,
                    {
                      backgroundColor: frequency === freq ? colors.primaryContainer : colors.surfaceContainerLow,
                      borderColor: frequency === freq ? colors.primary : colors.outlineVariant,
                    },
                  ]}
                  onPress={() => setFrequency(freq)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.freqText,
                      {
                        color: frequency === freq ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                        fontWeight: frequency === freq ? '700' : '500',
                      },
                    ]}
                  >
                    {freq.charAt(0).toUpperCase() + freq.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Start Date & End Date Row */}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Start Date</Text>
                <TouchableOpacity
                  style={[styles.textInput, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 }]}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={{ color: colors.onSurface, fontSize: 13 }}>{formatDateShort(startDate)}</Text>
                  <MaterialIcons name="calendar-today" size={16} color={colors.primary} />
                </TouchableOpacity>
                {showStartDatePicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowStartDatePicker(false);
                      if (selectedDate) setStartDate(selectedDate);
                    }}
                  />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>End Date (Optional)</Text>
                <TouchableOpacity
                  style={[styles.textInput, { borderColor: colors.outlineVariant, backgroundColor: colors.surfaceContainerLow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 }]}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={{ color: endDate ? colors.onSurface : colors.outline, fontSize: 13 }}>
                    {endDate ? formatDateShort(endDate) : 'No End Date'}
                  </Text>
                  {endDate ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setEndDate(null);
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="cancel" size={16} color={colors.outline} />
                    </TouchableOpacity>
                  ) : (
                    <MaterialIcons name="calendar-today" size={16} color={colors.outline} />
                  )}
                </TouchableOpacity>
                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={startDate}
                    onChange={(event, selectedDate) => {
                      setShowEndDatePicker(false);
                      if (selectedDate) setEndDate(selectedDate);
                    }}
                  />
                )}
              </View>
            </View>

            {/* Summary Text Box */}
            <View style={[styles.summaryBox, { backgroundColor: colors.primaryContainer }]}>
              <MaterialIcons name="repeat" size={18} color={colors.primary} />
              <Text style={[styles.summaryText, { color: colors.onPrimaryContainer }]}>
                {`Repeats ${frequency} starting ${formatDateShort(startDate)}${endDate ? ` until ${formatDateShort(endDate)}` : ''}`}
              </Text>
            </View>
          </View>
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

      {initialData?.receiptUrl && (
        <ImagePreviewModal
          visible={showImagePreview}
          imageUrl={initialData.receiptUrl}
          onClose={() => setShowImagePreview(false)}
        />
      )}
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
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  amountCurrency: {
    ...Typography.numericDisplay,
    fontSize: 40,
    fontWeight: '300',
  },
  amountInput: {
    ...Typography.numericDisplay,
    fontSize: 44,
    lineHeight: 52,
    minWidth: 40,
    textAlign: 'left',
    paddingVertical: 4,
    margin: 0,
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
  previewBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  previewText: {
    ...Typography.labelMd,
    fontSize: 10,
    color: '#FFF',
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
  recurringCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recurringTitle: {
    ...Typography.titleSm,
    fontWeight: '600',
  },
  recurringSub: {
    ...Typography.labelMd,
    fontSize: 12,
    marginTop: 2,
  },
  recurringConfigSection: {
    marginTop: 8,
  },
  recurringDivider: {
    height: 1,
    marginVertical: 10,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  freqPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqText: {
    ...Typography.labelMd,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: BorderRadius.md,
    marginTop: 12,
  },
  summaryText: {
    ...Typography.labelMd,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
