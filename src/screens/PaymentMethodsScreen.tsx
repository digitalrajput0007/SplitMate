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
import { OutlinedInput } from '../components/OutlinedInput';
import { auth } from '../config/firebase';
import { getCurrencyConfig } from '../services/currencyService';
import { getUserProfileFromFirestore, saveUserProfileToFirestore } from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentMethods'>;

export default function PaymentMethodsScreen({ navigation }: Props) {
  const currencyConfig = getCurrencyConfig();
  const currentUser = auth.currentUser;

  const [paymentHandle, setPaymentHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDefault, setIsDefault] = useState(true);

  useEffect(() => {
    if (currentUser?.uid) {
      getUserProfileFromFirestore(currentUser.uid).then((data) => {
        if (data?.paymentHandle) {
          setPaymentHandle(data.paymentHandle);
        }
      });
    }
  }, [currentUser]);

  const handleSave = async () => {
    if (!paymentHandle.trim()) {
      Alert.alert('Payment Handle Required', 'Please enter your payment handle or UPI ID.');
      return;
    }

    setSaving(true);
    try {
      if (currentUser?.uid) {
        await saveUserProfileToFirestore({
          uid: currentUser.uid,
          paymentHandle: paymentHandle.trim(),
        });
      }
      Alert.alert('Payment Method Saved', 'Your payment receiving details have been updated.');
      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving payment handle:', error);
      Alert.alert('Error', error.message || 'Failed to save payment handle.');
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
        <Text style={styles.topBarTitle}>Payment Methods</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Default Receiving Account</Text>
          <Text style={styles.cardSub}>
            Friends will use this payment handle when sending settlement payments directly to you.
          </Text>

          <OutlinedInput
            label={currencyConfig.paymentHandleLabel}
            value={paymentHandle}
            onChangeText={setPaymentHandle}
            placeholder={currencyConfig.paymentHandlePlaceholder}
          />

          <TouchableOpacity
            style={styles.defaultToggleRow}
            onPress={() => setIsDefault(!isDefault)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={isDefault ? 'check-box' : 'check-box-outline-blank'}
              size={24}
              color={isDefault ? Colors.primary : Colors.outlineVariant}
            />
            <Text style={styles.defaultToggleText}>Set as primary method for group settle-ups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, saving && styles.disabledButton]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.buttonText}>Save Payment Handle</Text>
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
  cardTitle: { ...Typography.headlineLgMobile, color: Colors.onSurface, fontSize: 18 },
  cardSub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, fontSize: 13 },
  defaultToggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.xs },
  defaultToggleText: { ...Typography.bodyMd, color: Colors.onSurface, flex: 1 },
  button: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.button,
  },
  disabledButton: { opacity: 0.7 },
  buttonText: { ...Typography.titleMd, color: Colors.onPrimary },
});
