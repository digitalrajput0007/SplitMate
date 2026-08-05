import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Modal,
  TextInput,
  Alert,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export default function RecurringExpensesScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const [subscriptions, setSubscriptions] = useState([
    { id: '1', title: 'Airtel Broadband', cycle: 'Monthly', nextDate: 'Aug 10', amount: 1199, splitWith: 'Flatmates (4)', active: true },
    { id: '2', title: 'Netflix Premium 4K', cycle: 'Monthly', nextDate: 'Aug 15', amount: 649, splitWith: 'Binge Watchers (3)', active: true },
  ]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingSub, setEditingSub] = useState<any | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [splitWith, setSplitWith] = useState('');

  const handleOpenAdd = () => {
    setEditingSub(null);
    setTitle('');
    setAmount('');
    setSplitWith('');
    setModalVisible(true);
  };

  const handleOpenEdit = (sub: any) => {
    setEditingSub(sub);
    setTitle(sub.title);
    setAmount(sub.amount.toString());
    setSplitWith(sub.splitWith);
    setModalVisible(true);
  };

  const handleSaveSub = () => {
    if (!title.trim() || !amount.trim()) {
      Alert.alert('Required', 'Please fill in subscription title and amount.');
      return;
    }

    if (editingSub) {
      setSubscriptions(prev => prev.map(s => s.id === editingSub.id ? {
        ...s,
        title: title.trim(),
        amount: parseFloat(amount) || s.amount,
        splitWith: splitWith.trim() || 'Shared Group',
      } : s));
    } else {
      const newSub = {
        id: Date.now().toString(),
        title: title.trim(),
        cycle: 'Monthly',
        nextDate: 'Sep 01',
        amount: parseFloat(amount) || 0,
        splitWith: splitWith.trim() || 'Flatmates Group',
        active: true,
      };
      setSubscriptions(prev => [...prev, newSub]);
    }
    setModalVisible(false);
  };

  const toggleSub = (id: string) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Recurring Expenses</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.bannerCard, { backgroundColor: colors.primaryFixed }]}>
          <View style={[styles.bannerIconBox, { backgroundColor: colors.surfaceContainerLowest }]}>
            <MaterialIcons name="autorenew" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.onPrimaryFixed }]}>Auto-Split Subscriptions</Text>
            <Text style={[styles.bannerSub, { color: colors.onPrimaryFixedVariant }]}>Never miss splitting rent, Wi-Fi or OTT bills with group members.</Text>
          </View>
        </View>

        <View style={styles.headerRow}>
          <Text style={[styles.sectionHeader, { color: colors.onBackground }]}>Active Subscriptions ({subscriptions.length})</Text>
          <TouchableOpacity onPress={handleOpenAdd}>
            <Text style={[styles.addLinkText, { color: colors.primary }]}>+ Add New</Text>
          </TouchableOpacity>
        </View>

        {subscriptions.map((sub) => (
          <View key={sub.id} style={[styles.recurringCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.categoryIcon, { backgroundColor: colors.surfaceContainerLow }]}>
                <MaterialIcons name="receipt-long" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.itemTitle, { color: colors.onSurface }]}>{sub.title}</Text>
                  <TouchableOpacity style={styles.editIconBtn} onPress={() => handleOpenEdit(sub)}>
                    <MaterialIcons name="edit" size={16} color={colors.outline} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.itemMeta, { color: colors.onSurfaceVariant }]}>{sub.cycle} • Next: {sub.nextDate}</Text>
              </View>
              <Text style={[styles.itemAmount, { color: colors.primary }]}>₹{sub.amount}</Text>
            </View>

            <View style={[styles.cardFooter, { borderTopColor: colors.divider }]}>
              <Text style={[styles.footerText, { color: colors.onSurfaceVariant }]}>Splitting with: <Text style={{ color: colors.onSurface, fontWeight: '600' }}>{sub.splitWith}</Text></Text>
              <Switch
                value={sub.active}
                onValueChange={() => toggleSub(sub.id)}
                trackColor={{ false: colors.surfaceContainerHigh, true: colors.primaryContainer }}
                thumbColor={sub.active ? colors.primary : colors.outline}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={handleOpenAdd} activeOpacity={0.85}>
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>+ Add Recurring Expense</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add / Edit Subscription Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.modalTitle, { color: colors.onSurface }]}>{editingSub ? 'Edit Subscription' : 'New Recurring Expense'}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, color: colors.onSurface }]}
              placeholder="Title (e.g. Wi-Fi Bill)"
              placeholderTextColor={colors.outline}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, color: colors.onSurface }]}
              placeholder="Amount (₹)"
              placeholderTextColor={colors.outline}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, color: colors.onSurface }]}
              placeholder="Group/Member (e.g. Flatmates)"
              placeholderTextColor={colors.outline}
              value={splitWith}
              onChangeText={setSplitWith}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: colors.onSurfaceVariant }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveSub}>
                <Text style={[styles.modalSaveText, { color: colors.onPrimary }]}>Save</Text>
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
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.md },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { ...Typography.titleSm, fontWeight: '600' },
  bannerSub: { ...Typography.bodyMd, marginTop: 2 },
  sectionHeader: { ...Typography.titleMd, fontWeight: '600', marginTop: Spacing.xs },
  recurringCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
    gap: Spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { ...Typography.titleSm, fontWeight: '600' },
  itemMeta: { ...Typography.labelMd, marginTop: 2 },
  itemAmount: { ...Typography.titleMd, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: Spacing.xs,
  },
  footerText: { ...Typography.labelMd },
  addBtn: {
    width: '100%',
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.button,
  },
  addBtnText: { ...Typography.titleMd },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xs },
  addLinkText: { ...Typography.titleSm, fontWeight: '700' },
  editIconBtn: { padding: 4, marginLeft: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: BorderRadius.xl, padding: 20, gap: 12, ...Shadows.dialog },
  modalTitle: { ...Typography.titleLg, fontWeight: '700', marginBottom: 4 },
  modalInput: { borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 10, ...Typography.bodyMd, borderWidth: 1 },
  modalActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { ...Typography.titleSm },
  modalSaveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: BorderRadius.md },
  modalSaveText: { ...Typography.titleSm, fontWeight: '700' },
});
