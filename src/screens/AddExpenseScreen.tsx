import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import { Spacing, Typography } from '../constants/theme';
import { auth } from '../config/firebase';
import {
  addExpenseToFirestore,
  subscribeToGroupDetail,
  getAllUsersFromFirestore,
  GroupData
} from '../services/firestoreService';
import { useTheme } from '../context/ThemeContext';
import ExpenseForm, { ExpenseFormData } from '../components/ExpenseForm';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

export default function AddExpenseScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const currentUser = auth.currentUser;
  const groupId = route.params?.groupId || 'goa_trip';

  const [group, setGroup] = useState<GroupData | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeToGroupDetail(groupId, async (data) => {
      if (data) {
        setGroup(data);
        const allUsers = await getAllUsersFromFirestore();
        const mapping: Record<string, string> = {};
        data.memberIds.forEach((uid) => {
          const user = allUsers.find(u => u.uid === uid);
          mapping[uid] = user ? (uid === currentUser?.uid ? 'You' : user.name) : 'Member';
        });
        setMemberMap(mapping);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [groupId, currentUser]);

  const handleSave = async (formData: ExpenseFormData) => {
    setSubmitting(true);
    try {
      await addExpenseToFirestore({
        groupId: groupId,
        ...formData,
      });
      navigation.goBack();
    } catch (error: any) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', error.message || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const members = Object.entries(memberMap).map(([uid, name]) => ({ uid, name }));

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
          <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Add Expense</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.content}>
            <ExpenseForm
              members={members}
              onSubmit={handleSave}
              submitting={submitting}
              submitLabel="Add Expense"
            />
          </View>
        )}
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
  content: { flex: 1, paddingHorizontal: Spacing.containerMargin },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
