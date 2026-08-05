import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StatusBar as RNStatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { OutlinedInput } from '../components/OutlinedInput';
import { auth } from '../config/firebase';
import { getCurrencyConfig } from '../services/currencyService';
import {
  getUserProfileFromFirestore,
  saveUserProfileToFirestore,
  PaymentMethod
} from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentMethods'>;

export default function PaymentMethodsScreen({ navigation }: Props) {
  const currencyConfig = getCurrencyConfig();
  const currentUser = auth.currentUser;
  const { colors, isDark } = useTheme();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal State for Adding/Editing
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newHandle, setNewHandle] = useState('');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    if (currentUser?.uid) {
      getUserProfileFromFirestore(currentUser.uid)
        .then((data) => {
          if (data?.paymentMethods) {
            setMethods(data.paymentMethods);
          } else if (data?.paymentHandle) {
            // Migrating legacy single handle to array if first time
            setMethods([{
              id: 'initial',
              handle: data.paymentHandle,
              type: 'UPI',
              label: 'Primary UPI',
              isDefault: true
            }]);
          }
        })
        .catch(() => {
          Alert.alert('Error', 'Failed to load payment methods');
        })
        .finally(() => setLoading(false));
    }
  }, [currentUser]);

  const validateUPI = (handle: string) => {
    return handle.includes('@') && handle.trim().length >= 3;
  };

  const handleSaveToCloud = async (updatedMethods: PaymentMethod[]) => {
    if (!currentUser?.uid) return;

    setSaving(true);
    try {
      const defaultMethod = updatedMethods.find(m => m.isDefault);

      await saveUserProfileToFirestore({
        uid: currentUser.uid,
        paymentMethods: updatedMethods,
        // Sync legacy field for backward compatibility
        paymentHandle: defaultMethod ? defaultMethod.handle : (updatedMethods[0]?.handle || ''),
      });

      setMethods(updatedMethods);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not sync with server');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOrUpdate = () => {
    const trimmedHandle = newHandle.trim();
    if (!validateUPI(trimmedHandle)) {
      Alert.alert('Invalid UPI ID', 'Please enter a valid UPI ID (e.g. name@bank)');
      return;
    }

    let updatedList: PaymentMethod[];

    if (editingId) {
      updatedList = methods.map(m =>
        m.id === editingId ? { ...m, handle: trimmedHandle, label: newLabel || 'UPI ID' } : m
      );
    } else {
      const newMethod: PaymentMethod = {
        id: Date.now().toString(),
        handle: trimmedHandle,
        type: 'UPI',
        label: newLabel || 'UPI ID',
        isDefault: methods.length === 0
      };
      updatedList = [...methods, newMethod];
    }

    handleSaveToCloud(updatedList);
    setModalVisible(false);
    setNewHandle('');
    setNewLabel('');
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Remove Payment Method', 'Are you sure you want to delete this UPI ID?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const updatedList = methods.filter(m => m.id !== id);
          if (updatedList.length > 0 && !updatedList.find(m => m.isDefault)) {
            updatedList[0].isDefault = true;
          }
          handleSaveToCloud(updatedList);
        }
      }
    ]);
  };

  const handleSetDefault = (id: string) => {
    const updatedList = methods.map(m => ({
      ...m,
      isDefault: m.id === id
    }));
    handleSaveToCloud(updatedList);
  };

  const openAddModal = () => {
    setEditingId(null);
    setNewHandle('');
    setNewLabel('');
    setModalVisible(true);
  };

  const openEditModal = (method: PaymentMethod) => {
    setEditingId(method.id);
    setNewHandle(method.handle);
    setNewLabel(method.label);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Payment Methods</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <MaterialIcons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.infoBox}>
          <Text style={[styles.infoText, { color: colors.onSurfaceVariant }]}>
            Add your UPI IDs so friends can settle up with you directly via their preferred apps.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : methods.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="account-balance-wallet" size={64} color={colors.outlineVariant} />
            <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>No UPI IDs Linked</Text>
            <Text style={[styles.emptySub, { color: colors.onSurfaceVariant }]}>Tap the + button to add your first payment method.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {methods.map((method) => (
              <View
                key={method.id}
                style={[
                  styles.methodCard,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: method.isDefault ? colors.primary : colors.divider
                  }
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
                    <Text style={styles.upiIconText}>VPA</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.methodLabel, { color: colors.onSurface }]}>{method.label}</Text>
                    <Text style={[styles.methodHandle, { color: colors.primary }]}>{method.handle}</Text>
                  </View>
                  {method.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: colors.positiveContainer }]}>
                      <Text style={[styles.defaultBadgeText, { color: colors.positiveText }]}>Default</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.cardActions, { borderTopColor: colors.divider }]}>
                  {!method.isDefault && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleSetDefault(method.id)}>
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Set Default</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(method)}>
                    <MaterialIcons name="edit" size={18} color={colors.onSurfaceVariant} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(method.id)}>
                    <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>
              {editingId ? 'Edit UPI ID' : 'Add New UPI ID'}
            </Text>

            <View style={{ gap: Spacing.md }}>
              <OutlinedInput
                label="Label (e.g. My PhonePe)"
                value={newLabel}
                onChangeText={setNewLabel}
                placeholder="Personal UPI"
              />
              <OutlinedInput
                label="UPI ID / VPA"
                value={newHandle}
                onChangeText={(val) => setNewHandle(val.replace(/\s+/g, ''))}
                placeholder="username@okaxis"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancel, { backgroundColor: colors.surfaceContainerHigh }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.onSurface }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
                onPress={handleAddOrUpdate}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>{editingId ? 'Update' : 'Add'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, fontWeight: '700' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: 40 },
  infoBox: { marginBottom: Spacing.lg },
  infoText: { ...Typography.bodyMd, lineHeight: 20 },
  listContainer: { gap: Spacing.md },
  methodCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upiIconText: { fontSize: 10, fontWeight: '700', opacity: 0.6 },
  methodLabel: { ...Typography.titleSm, fontWeight: '700' },
  methodHandle: { ...Typography.bodyMd, marginTop: 2 },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  defaultBadgeText: { ...Typography.labelMd, fontWeight: '700' },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  actionBtn: { padding: 4 },
  actionBtnText: { ...Typography.labelLg, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyTitle: { ...Typography.titleLg, fontWeight: '700' },
  emptySub: { ...Typography.bodyMd, textAlign: 'center', paddingHorizontal: 40 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },
  modalTitle: { ...Typography.headlineSm, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 10 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
  modalSave: { flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md, alignItems: 'center' },
  modalCancelText: { ...Typography.titleSm, fontWeight: '600' },
  modalSaveText: { ...Typography.titleSm, fontWeight: '700', color: '#fff' },
});
