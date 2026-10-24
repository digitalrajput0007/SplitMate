import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Share,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { formatCurrency } from '../services/currencyService';
import { parseFirestoreDate } from '../utils/dateUtils';
import { auth } from '../config/firebase';
import {
  updateExpenseInFirestore,
  deleteExpenseFromFirestore,
  subscribeToGroupDetail,
  subscribeToExpenseDetail,
  getAllUsersFromFirestore,
  addCommentToExpense,
  subscribeToExpenseComments,
  ExpenseData,
  GroupData,
  ExpenseComment,
} from '../services/firestoreService';
import { useTheme } from '../context/ThemeContext';
import { useDialog } from '../context/DialogContext';
import ExpenseForm, { ExpenseFormData } from '../components/ExpenseForm';
import { ImagePreviewModal } from '../components/ImagePreviewModal';
import { useMediaManager } from '../hooks/useMediaManager';
import { MediaPickerSheet } from '../components/MediaPickerSheet';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>;

export default function ExpenseDetailScreen({ navigation, route }: Props) {
  const initialExpense: ExpenseData | undefined = route.params?.expense;
  const targetExpenseId = route.params?.expenseId || initialExpense?.expenseId;
  const { colors } = useTheme();
  const dialog = useDialog();
  const currentUser = auth.currentUser;

  const [expense, setExpense] = useState<ExpenseData | null>(initialExpense || null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<ExpenseComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

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
    id: expense?.groupId || 'temp',
    onSuccess: (urls) => {
      if (expense) {
        setExpense({ ...expense, receiptUrl: urls.original });
      }
    },
  });

  useEffect(() => {
    if (targetExpenseId) {
      const unsub = subscribeToExpenseDetail(targetExpenseId, (data) => {
        if (data) {
          setExpense(data);
        }
      });

      const unsubComments = subscribeToExpenseComments(targetExpenseId, (commentList) => {
        setComments(commentList);
      });

      return () => {
        unsub();
        unsubComments();
      };
    }
  }, [targetExpenseId]);

  useEffect(() => {
    if (expense?.groupId) {
      const unsub = subscribeToGroupDetail(expense.groupId, async (data) => {
        if (data) {
          setGroup(data);
          // Fetch names for all member IDs
          const allUsers = await getAllUsersFromFirestore();
          const mapping: Record<string, string> = {};
          data.memberIds.forEach((uid) => {
            const user = allUsers.find(u => u.uid === uid);
            if (user) {
              mapping[uid] = uid === currentUser?.uid ? 'You' : user.name;
            } else {
              mapping[uid] = 'Member';
            }
          });
          setMemberMap(mapping);
        }
      });
      return () => unsub();
    }
  }, [expense?.groupId, currentUser]);

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
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const members = Object.entries(memberMap).map(([uid, name]) => ({ uid, name }));
  const payerName = memberMap[expense.paidBy] || 'Unknown';
  const isCreator = (expense.createdBy || expense.paidBy) === currentUser?.uid;

  const handleUpdate = async (formData: ExpenseFormData) => {
    if (!expense?.expenseId) return;

    setSaving(true);
    try {
      await updateExpenseInFirestore(expense.expenseId, formData);
      setIsEditing(false);
      dialog.showSuccess('Expense Updated', 'Group expense updated successfully.');
    } catch (error: any) {
      console.error('Error updating expense:', error);
      dialog.showError('Error', error.message || 'Failed to update expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!expense?.expenseId) return;

    dialog.showConfirm(
      'Delete Expense',
      `Are you sure you want to delete "${expense.title}"? Group balances will be recalculated immediately.`,
      async () => {
        try {
          await deleteExpenseFromFirestore(expense.expenseId!);
          navigation.goBack();
        } catch (error: any) {
          console.error('Error deleting expense:', error);
          dialog.showError('Error', error.message || 'Failed to delete expense.');
        }
      },
      { confirmText: 'Delete', destructive: true }
    );
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !expense?.expenseId) return;
    setSendingComment(true);
    try {
      await addCommentToExpense(expense.expenseId, newComment);
      setNewComment('');
    } catch (e) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSendingComment(false);
    }
  };

  const handleShare = async () => {
    if (!expense) return;
    try {
      const shareMessage = `SplitMate Expense: ${expense.title}\nAmount: ${formatCurrency(expense.amount)}\nPaid by: ${payerName}\nGroup: ${group?.name || ''}`;
      await Share.share({
        message: shareMessage,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  const formatDate = (timestamp: any) => {
    const date = parseFirestoreDate(timestamp, expense?.date);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (timestamp: any) => {
    const date = parseFirestoreDate(timestamp, expense?.date);
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.divider }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>
          {isEditing ? 'Edit Expense' : 'Expense Details'}
        </Text>
        {isCreator ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => setIsEditing(!isEditing)}>
            <MaterialIcons name={isEditing ? 'close' : 'edit'} size={22} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      {isEditing ? (
        <View style={styles.formContainer}>
          <ExpenseForm
            members={members}
            initialData={expense}
            onPickReceipt={() => setIsPickerVisible(true)}
            onRemoveReceipt={() => setExpense(expense ? { ...expense, receiptUrl: '' } : null)}
            onSubmit={handleUpdate}
            submitting={saving}
            submitLabel="Update Expense"
            isUploading={isUploading}
            progress={progress}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* 1. Main Header Card */}
          <View style={[styles.headerCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={[styles.categoryBadge, { backgroundColor: colors.primaryFixed }]}>
              <Text style={styles.categoryEmoji}>{expense.category?.split(' ')[0] || '💸'}</Text>
            </View>
            <Text style={[styles.expenseTitle, { color: colors.onSurface }]}>{expense.title}</Text>
            <Text style={[styles.expenseAmount, { color: colors.primary }]}>{formatCurrency(expense.amount)}</Text>
            <Text style={[styles.expenseDate, { color: colors.onSurfaceVariant }]}>{formatDate(expense.createdAt)}</Text>
          </View>

          {/* 2. Key Details List */}
          <View style={styles.section}>
            <View style={[styles.detailsList, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              <DetailRow icon="label-outline" label="Category" value={expense.category} colors={colors} />
              <DetailRow icon="person-outline" label="Paid By" value={payerName} colors={colors} />
              <DetailRow icon="event" label="Date" value={formatDate(expense.createdAt)} colors={colors} />
              <DetailRow icon="call-split" label="Split Type" value={expense.splitType.toUpperCase()} colors={colors} isLast />
            </View>
          </View>

          {/* 3. Split Breakdown */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Split Breakdown</Text>
            <View style={[styles.breakdownList, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
              {Object.entries(expense.splitDetails || {}).map(([memberId, share], index, arr) => {
                const mName = memberMap[memberId] || 'Member';
                return (
                  <View key={memberId} style={[styles.breakdownRow, index !== arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                    <Text style={[styles.memberName, { color: colors.onSurface }]}>
                      {memberId === expense.paidBy ? `${mName} (Paid Total)` : mName}
                    </Text>
                    <Text style={[styles.memberShare, { color: colors.primary }]}>{formatCurrency(share)}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* 4. Receipt */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Receipt</Text>
            {expense.receiptUrl ? (
              <TouchableOpacity onPress={() => setShowImagePreview(true)} activeOpacity={0.9}>
                <Image source={{ uri: expense.receiptUrl }} style={styles.receiptImage} />
                <View style={[styles.previewBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <MaterialIcons name="fullscreen" size={20} color="#FFF" />
                  <Text style={styles.previewText}>Click to preview</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.placeholderBox, { backgroundColor: colors.surfaceContainerLow, borderStyle: 'dashed', borderColor: colors.outlineVariant }]}>
                <MaterialIcons name="receipt" size={32} color={colors.outline} />
                <Text style={[styles.placeholderText, { color: colors.onSurfaceVariant }]}>No receipt attached</Text>
              </View>
            )}
          </View>

          {/* 5. Notes */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Notes</Text>
            <View style={[styles.placeholderBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.divider, alignItems: 'flex-start', padding: Spacing.md, height: 'auto', minHeight: 60 }]}>
              <Text style={[styles.notesText, { color: colors.onSurfaceVariant, fontStyle: expense.notes ? 'normal' : 'italic' }]}>
                {expense.notes || 'No notes added for this expense.'}
              </Text>
            </View>
          </View>

          {/* 6. System Info */}
          <View style={styles.metadataBox}>
            <Text style={[styles.metadataText, { color: colors.outline }]}>
              Created on {formatDateTime(expense.createdAt)}
            </Text>
          </View>

          {/* 7. Secondary Actions */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: colors.surfaceContainerLow }]}
              onPress={() => setShowComments(!showComments)}
            >
              <MaterialIcons name="comment" size={18} color={colors.primary} />
              <Text style={[styles.actionChipText, { color: colors.onSurface }]}>
                Comments {comments.length > 0 ? `(${comments.length})` : ''}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: colors.surfaceContainerLow }]}
              onPress={handleShare}
            >
              <MaterialIcons name="share" size={18} color={colors.primary} />
              <Text style={[styles.actionChipText, { color: colors.onSurface }]}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* 7.5 Comments Section */}
          {showComments && (
            <View style={[styles.commentsContainer, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant }]}>
              <View style={[styles.commentInputRow, { borderBottomColor: colors.outlineVariant }]}>
                <TextInput
                  style={[styles.commentInput, { color: colors.onSurface, backgroundColor: colors.surfaceContainerLow }]}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendCommentBtn, { backgroundColor: colors.primary }, !newComment.trim() && { opacity: 0.5 }]}
                  onPress={handleAddComment}
                  disabled={sendingComment || !newComment.trim()}
                >
                  {sendingComment ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <MaterialIcons name="send" size={18} color={colors.onPrimary} />}
                </TouchableOpacity>
              </View>

              <View style={styles.commentList}>
                {comments.length === 0 ? (
                  <Text style={[styles.noCommentsText, { color: colors.onSurfaceVariant }]}>No comments yet.</Text>
                ) : (
                  comments.map((c) => (
                    <View key={c.commentId} style={[styles.commentItem, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
                      <View style={styles.commentHeader}>
                        <Text style={[styles.commentUser, { color: colors.primary }]}>{c.userName}</Text>
                        <Text style={[styles.commentTime, { color: colors.onSurfaceVariant }]}>
                          {parseFirestoreDate(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <Text style={[styles.commentText, { color: colors.onSurface, marginTop: 4 }]}>{c.text}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          {/* 8. Danger Zone (Owner Only) */}
          {isCreator && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.errorContainer }]}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                <Text style={[styles.deleteBtnText, { color: colors.error }]}>Delete Expense</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {expense.receiptUrl && (
        <ImagePreviewModal
          visible={showImagePreview}
          imageUrl={expense.receiptUrl}
          onClose={() => setShowImagePreview(false)}
        />
      )}

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

function DetailRow({ icon, label, value, colors, isLast }: { icon: keyof typeof MaterialIcons.glyphMap, label: string, value: string, colors: any, isLast?: boolean }) {
  return (
    <View style={[styles.detailRow, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
      <View style={styles.detailLabelRow}>
        <MaterialIcons name={icon} size={18} color={colors.primary} />
        <Text style={[styles.detailLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
      </View>
      <Text style={[styles.detailValue, { color: colors.onSurface }]}>{value}</Text>
    </View>
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
    borderBottomWidth: 1,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  formContainer: { flex: 1, paddingHorizontal: Spacing.containerMargin, paddingTop: Spacing.md },
  headerCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.card,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  categoryBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  categoryEmoji: { fontSize: 32 },
  expenseTitle: { ...Typography.headlineSm, textAlign: 'center', fontWeight: '700' },
  expenseAmount: { ...Typography.numericDisplay, marginVertical: 4, fontSize: 36 },
  expenseDate: { ...Typography.bodyMd, opacity: 0.8 },
  expenseMeta: { ...Typography.bodyMd },
  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.labelLg, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 4 },
  detailsList: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.card,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: { ...Typography.bodyMd, fontWeight: '500' },
  detailValue: { ...Typography.bodyLg, fontWeight: '600' },
  breakdownList: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.card,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  memberName: { ...Typography.bodyLg, fontWeight: '500' },
  memberShare: { ...Typography.titleMd, fontWeight: '700' },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
    resizeMode: 'cover',
    marginTop: 4,
  },
  previewBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  previewText: {
    ...Typography.labelMd,
    color: '#FFF',
  },
  placeholderBox: {
    width: '100%',
    height: 100,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  placeholderText: { ...Typography.bodyMd, fontWeight: '500' },
  notesText: { ...Typography.bodyMd, lineHeight: 20 },
  metadataBox: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  metadataText: { ...Typography.labelMd, fontStyle: 'italic' },
  secondaryActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  actionChipText: { ...Typography.labelLg },
  commentsContainer: {
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  commentInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
    ...Typography.bodyMd,
  },
  sendCommentBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentList: {
    paddingTop: 12,
    gap: 10,
  },
  commentItem: {
    padding: 10,
    borderRadius: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentUser: {
    ...Typography.labelLg,
    fontWeight: '700',
  },
  commentTime: {
    fontSize: 10,
  },
  commentText: {
    ...Typography.bodyMd,
  },
  noCommentsText: {
    textAlign: 'center',
    ...Typography.bodyMd,
    fontStyle: 'italic',
  },
  actionsRow: { marginTop: Spacing.md, marginBottom: Spacing.xl },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Shadows.button,
  },
  deleteBtnText: { ...Typography.titleMd, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
