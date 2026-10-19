import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { RootStackParamList } from '../navigation/types';
import { Spacing, Typography } from '../constants/theme';
import { auth } from '../config/firebase';
import {
  addExpenseToFirestore,
  createRecurringExpenseInFirestore,
  subscribeToGroupDetail,
  subscribeToAcceptedMembers,
  getAllUsersFromFirestore,
  GroupData,
  UserProfile,
} from '../services/firestoreService';
import { useMediaManager } from '../hooks/useMediaManager';
import { MediaPickerSheet } from '../components/MediaPickerSheet';
import { useTheme } from '../context/ThemeContext';
import ExpenseForm, { ExpenseFormData } from '../components/ExpenseForm';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

export default function AddExpenseScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const currentUser = auth.currentUser;
  const { groupId, groupName, initialBillingMonth } = route.params || {};

  const [group, setGroup] = useState<GroupData | null>(null);
  const [activeMembers, setActiveMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptMetadata, setReceiptMetadata] = useState<any>(null);
  const groupOwnerRef = useRef<string | null>(null);

  const {
    isUploading,
    progress,
    isPickerVisible,
    setIsPickerVisible,
    takePhoto,
    pickFromGallery,
    browseFiles,
  } = useMediaManager({
    purpose: 'receipt',
    id: groupId || 'temp',
    onSuccess: (urls) => {
      setReceiptUrl(urls.original);
      if (urls.metadata) setReceiptMetadata(urls.metadata);
      // OCR Architecture Placeholder:
      // triggerOCR(urls.original).then(data => populateForm(data));
    },
  });

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const unsubGroup = subscribeToGroupDetail(groupId, (data) => {
      if (data) {
        if (data.createdBy) groupOwnerRef.current = data.createdBy;
      } else {
        const isOwner = groupOwnerRef.current === currentUser?.uid;
        if (isOwner) {
          navigation.navigate('MainTabs', { screen: 'GroupsTab' } as any);
        } else {
          Alert.alert(
            'Group Deleted',
            'The group owner has deleted this group.',
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.navigate('MainTabs', { screen: 'GroupsTab' } as any);
                },
              },
            ]
          );
        }
      }
    });

    const unsubMembers = subscribeToAcceptedMembers(groupId, (accepted) => {
      setActiveMembers(accepted);
      setLoading(false);
    });

    return () => {
      unsubGroup();
      unsubMembers();
    };
  }, [groupId]);

  const handleSave = async (formData: ExpenseFormData) => {
    setSubmitting(true);
    try {
      await addExpenseToFirestore({
        groupId: groupId || '',
        createdBy: currentUser?.uid || formData.paidBy,
        ...formData,
        receiptUrl: receiptUrl,
        receiptMetadata: receiptMetadata,
      });

      if (formData.recurringConfig?.isRecurring) {
        await createRecurringExpenseInFirestore({
          groupId: groupId || '',
          title: formData.title,
          amount: formData.amount,
          paidBy: formData.paidBy,
          splitDetails: formData.splitDetails,
          splitType: formData.splitType,
          category: formData.category,
          notes: formData.notes,
          frequency: formData.recurringConfig.frequency,
          startDate: formData.recurringConfig.startDate,
          endDate: formData.recurringConfig.endDate,
        });
      }

      navigation.goBack();
    } catch (error: any) {
      console.error('Error adding expense:', error);
      Alert.alert('Error', error.message || 'Failed to save expense.');
    } finally {
      setSubmitting(false);
    }
  };

  const membersForForm = useMemo(() => {
    const list = activeMembers.map((m) => ({
      uid: m.uid,
      name: m.uid === currentUser?.uid ? 'You' : m.name,
      photoUrl: m.photoUrl,
      photoThumbnailUrl: m.photoThumbnailUrl,
    }));
    // Sort so "You" is always in the first position
    return list.sort((a, b) => {
      if (a.uid === currentUser?.uid) return -1;
      if (b.uid === currentUser?.uid) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [activeMembers, currentUser?.uid]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Add Expense</Text>
            {groupName && <Text style={[styles.groupSubtitle, { color: colors.primary }]}>{groupName}</Text>}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.content}>
            <ExpenseForm
              members={membersForForm}
              initialData={{ paidBy: currentUser?.uid || '', receiptUrl: receiptUrl }}
              initialBillingMonth={initialBillingMonth}
              onPickReceipt={() => setIsPickerVisible(true)}
              onRemoveReceipt={() => setReceiptUrl('')}
              onSubmit={handleSave}
              submitting={submitting}
              submitLabel="Add Expense"
              isUploading={isUploading}
              progress={progress}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      <MediaPickerSheet
        visible={isPickerVisible}
        onDismiss={() => setIsPickerVisible(false)}
        onCamera={takePhoto}
        onGallery={pickFromGallery}
        onFiles={browseFiles}
        title="Attach Receipt"
      />
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
  groupSubtitle: { ...Typography.bodySm, fontWeight: '700', marginTop: -2 },
  content: { flex: 1, paddingHorizontal: Spacing.containerMargin },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
