import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { auth } from '../config/firebase';
import { getUserProfileFromFirestore, updateUserPreferencesInFirestore } from '../services/firestoreService';

import { setActiveUserCurrency } from '../services/currencyService';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee (₹)' },
  { code: 'USD', name: 'US Dollar ($)' },
  { code: 'EUR', name: 'Euro (€)' },
  { code: 'GBP', name: 'British Pound (£)' },
  { code: 'CAD', name: 'Canadian Dollar (CA$)' },
  { code: 'AUD', name: 'Australian Dollar (A$)' },
  { code: 'AED', name: 'UAE Dirham (AED)' },
];

export default function AppSettingsScreen({ navigation }: Props) {
  const currentUser = auth.currentUser;

  const [selectedCurrency, setSelectedCurrency] = useState('INR');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      getUserProfileFromFirestore(currentUser.uid).then((data) => {
        if (data?.preferredCurrency) {
          setSelectedCurrency(data.preferredCurrency);
        } else if (data?.preferences?.currency) {
          setSelectedCurrency(data.preferences.currency);
        }
      });
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser?.uid) return;
    setSaving(true);
    try {
      // 1. Update Firestore Profile
      await updateUserPreferencesInFirestore(currentUser.uid, {
        currency: selectedCurrency,
      });

      // 2. Set Active Global Currency for whole application
      setActiveUserCurrency(selectedCurrency);

      Alert.alert('Currency Saved', `${selectedCurrency} currency has been applied to the entire application.`);
      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving currency settings:', error);
      Alert.alert('Error', error.message || 'Failed to save currency.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Currency Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Select Application Currency</Text>
          <Text style={styles.sectionSub}>Chosen currency will be applied to all group balances, expense items, and settlements.</Text>

          <View style={styles.optionsList}>
            {CURRENCIES.map((c) => {
              const isSelected = selectedCurrency === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                  onPress={() => setSelectedCurrency(c.code)}
                >
                  <Text style={styles.optionText}>{c.name}</Text>
                  <MaterialIcons
                    name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={22}
                    color={isSelected ? Colors.primary : Colors.outlineVariant}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.disabledButton]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.buttonText}>Save Currency</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
    gap: Spacing.md,
  },
  sectionLabel: { ...Typography.titleMd, color: Colors.onSurface, fontSize: 15 },
  sectionSub: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: -4 },
  optionsList: { gap: Spacing.xs },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  optionRowSelected: {
    backgroundColor: Colors.primaryFixed,
  },
  optionText: { ...Typography.bodyLg, color: Colors.onSurface, fontSize: 14 },
  divider: { height: 1, backgroundColor: Colors.divider },
  rowTwo: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  chipSelected: { backgroundColor: Colors.primary },
  chipText: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  chipTextSelected: { color: Colors.onPrimary, fontWeight: '600' },
  button: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    ...Shadows.button,
  },
  disabledButton: { opacity: 0.7 },
  buttonText: { ...Typography.titleMd, color: Colors.onPrimary },
});
