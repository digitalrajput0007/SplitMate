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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';

export default function RecurringExpensesScreen() {
  const navigation = useNavigation();

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
      setSubscriptions(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          title: title.trim(),
          cycle: 'Monthly',
          nextDate: 'Sep 1',
          amount: parseFloat(amount) || 0,
          splitWith: splitWith.trim() || 'Shared Group',
          active: true,
        }
      ]);
    }
    setModalVisible(false);
  };

  const toggleSub = (id: string) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={Colors.onBackground} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Active Subscriptions</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerIconBox}>
            <Text style={{ fontSize: 24 }}>🔄</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Never miss a subscription</Text>
            <Text style={styles.bannerSub}>Set up recurring splits for rent, WiFi, and shared streaming accounts.</Text>
          </View>
        </View>

        {/* Subscriptions List Section */}
        <View style={styles.headerRow}>
          <Text style={styles.sectionHeader}>Active Subscriptions ({subscriptions.length})</Text>
          <TouchableOpacity onPress={handleOpenAdd}>
            <Text style={styles.addLinkText}>+ Add New</Text>
          </TouchableOpacity>
        </View>

        {subscriptions.map((sub) => (
          <View key={sub.id} style={styles.recurringCard}>
            <View style={styles.cardHeader}>
              <View style={[styles.categoryIcon, { backgroundColor: '#E8F5E9' }]}>
                <Text style={{ fontSize: 20 }}>📶</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{sub.title}</Text>
                <Text style={styles.itemMeta}>{sub.cycle} • Next on {sub.nextDate}</Text>
              </View>
              <Text style={styles.itemAmount}>₹{sub.amount}</Text>
              <TouchableOpacity style={styles.editIconBtn} onPress={() => handleOpenEdit(sub)}>
                <MaterialIcons name="edit" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.footerText}>Split with {sub.splitWith}</Text>
              <Switch value={sub.active} onValueChange={() => toggleSub(sub.id)} trackColor={{ true: Colors.primary }} />
            </View>
          </View>
        ))}

        {/* Add New Recurring Expense Button */}
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={handleOpenAdd}>
          <Text style={styles.addBtnText}>+ Add Recurring Subscription</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit / Add Subscription Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingSub ? 'Edit Subscription' : 'Add Subscription'}</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Subscription Name (e.g. Netflix, Rent)"
              placeholderTextColor={Colors.outline}
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Monthly Amount (e.g. 649)"
              placeholderTextColor={Colors.outline}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Split with Group (e.g. Flatmates)"
              placeholderTextColor={Colors.outline}
              value={splitWith}
              onChangeText={setSplitWith}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveSub}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.md },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryFixed,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  bannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { ...Typography.titleSm, color: Colors.onPrimaryFixed, fontWeight: '600' },
  bannerSub: { ...Typography.bodyMd, color: Colors.onPrimaryFixedVariant, marginTop: 2 },
  sectionHeader: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600', marginTop: Spacing.xs },
  recurringCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
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
  itemTitle: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
  itemMeta: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  itemAmount: { ...Typography.titleMd, color: Colors.primary, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.xs,
  },
  footerText: { ...Typography.labelMd, color: Colors.onSurfaceVariant },
  addBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.button,
  },
  addBtnText: { ...Typography.titleMd, color: Colors.onPrimary },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xs },
  addLinkText: { ...Typography.titleSm, color: Colors.primary, fontWeight: '700' },
  editIconBtn: { padding: 4, marginLeft: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: Colors.surfaceContainerLowest, borderRadius: BorderRadius.xl, padding: 20, gap: 12, ...Shadows.dialog },
  modalTitle: { ...Typography.titleLg, color: Colors.onSurface, fontWeight: '700', marginBottom: 4 },
  modalInput: { backgroundColor: Colors.surfaceContainerLow, borderRadius: BorderRadius.md, paddingHorizontal: 14, paddingVertical: 10, ...Typography.bodyMd, color: Colors.onSurface, borderWidth: 1, borderColor: Colors.outlineVariant },
  modalActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { ...Typography.titleSm, color: Colors.onSurfaceVariant },
  modalSaveBtn: { backgroundColor: Colors.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: BorderRadius.md },
  modalSaveText: { ...Typography.titleSm, color: Colors.onPrimary, fontWeight: '700' },
});
