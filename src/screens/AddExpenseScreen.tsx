import React, { useState, useRef } from 'react';
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
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import { addExpenseToFirestore } from '../services/firestoreService';
import { ExpenseForm, ExpenseFormHandle } from '../components/ExpenseForm';
import { useTheme } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

const MEMBERS = [
  { uid: 'user_current', name: 'You' },
  { uid: 'user_priya_101', name: 'Priya' },
  { uid: 'user_amit_102', name: 'Amit' },
  { uid: 'user_neha_103', name: 'Neha' },
];

export default function AddExpenseScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const currentUser = auth.currentUser;
  const currentUid = currentUser?.uid || 'user_current';
  const groupId = route.params?.groupId || 'goa_trip';

  const formRef = useRef<ExpenseFormHandle>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeMembers = MEMBERS.map((m) =>
    m.uid === 'user_current' ? { ...m, uid: currentUid } : m
  );

  const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>(activeMembers.map(m => m.uid));

  const handleSubmit = async () => {
    const response = formRef.current?.getFormData();
    if (!response) return;

    if (response.error) {
      Alert.alert('Validation Error', response.error);
      return;
    }

    if (!response.data) return;

    setSubmitting(true);
    try {
      await addExpenseToFirestore({
        groupId: groupId,
        ...response.data,
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.onSurface }]}>Add Expense</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ExpenseForm
            ref={formRef}
            members={activeMembers}
            currentUid={currentUid}
            selectedMemberUids={selectedMemberUids}
            onSelectedMembersChange={setSelectedMemberUids}
          />

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary },
              submitting && styles.disabledBtn
            ]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>Add Expense</Text>
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

