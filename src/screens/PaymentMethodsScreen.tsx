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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { OutlinedInput } from '../components/OutlinedInput';
import { auth } from '../config/firebase';
import { getCurrencyConfig } from '../services/currencyService';
import { getUserProfileFromFirestore, saveUserProfileToFirestore } from '../services/firestoreService';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentMethods'>;

export default function PaymentMethodsScreen({ navigation }: Props) {
  const currencyConfig = getCurrencyConfig();
  const currentUser = auth.currentUser;
  const { colors, isDark } = useTheme();

  const [paymentHandle, setPaymentHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDefault, setIsDefault] = useState(true);

  useEffect(() => {
    if (currentUser?.uid) {
      getUserProfileFromFirestore(currentUser.uid)
        .then((data) => {
          if (data?.paymentHandle) {
            setPaymentHandle(data.paymentHandle);
          }
        })
        .catch(() => {
          Alert.alert('Error', 'Network error, check your connection');
        });
    }
  }, [currentUser]);

  const handleTextChange = (text: string) => {
    setPaymentHandle(text.replace(/\s+/g, ''));
  };

  const isValidUpi = paymentHandle.includes('@') && paymentHandle.trim().length >= 3;

  const handleSave = async () => {
    const trimmed = paymentHandle.trim();
    if (!trimmed) {
      Alert.alert('Payment Handle Required', 'Please enter your payment handle or UPI ID.');
      return;
    }

    if (!isValidUpi) {
      Alert.alert('Invalid UPI ID', 'Please provide a valid UPI ID containing @ (e.g. user@okhdfcbank).');
      return;
    }

    setSaving(true);
    try {
      if (currentUser?.uid) {
        await saveUserProfileToFirestore({
          uid: currentUser.uid,
          paymentHandle: trimmed,
        });

        Alert.alert(
          'Payment Handle Saved',
          `Your ${currencyConfig.paymentHandleLabel} (${trimmed}) has been linked to your profile for easy group payments.`
        );
        navigation.goBack();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save payment handle.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>{currencyConfig.paymentMethodsTitle}</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Linked UPI ID / VPA</Text>
            <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
              Friends will see this when settling up expenses with you directly.
            </Text>
          </View>

          <View>
            <OutlinedInput
              label={currencyConfig.paymentHandleLabel}
              value={paymentHandle}
              onChangeText={handleTextChange}
              placeholder={currencyConfig.paymentHandlePlaceholder}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {paymentHandle.length > 0 && (
              <View style={styles.validationRow}>
                <MaterialIcons
                  name={isValidUpi ? 'check-circle' : 'error-outline'}
                  size={16}
                  color={isValidUpi ? colors.positive : colors.error}
                />
                <Text style={[styles.validationText, { color: isValidUpi ? colors.positive : colors.error }]}>
                  {isValidUpi ? 'Valid UPI ID format' : 'Must include @ and handle name'}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.defaultToggleRow}
            onPress={() => setIsDefault(!isDefault)}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name={isDefault ? 'check-box' : 'check-box-outline-blank'}
              size={22}
              color={isDefault ? colors.primary : colors.outlineVariant}
            />
            <Text style={[styles.defaultToggleText, { color: colors.onSurface }]}>Set as primary method for group settle-ups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, (saving || (paymentHandle.length > 0 && !isValidUpi)) && styles.disabledButton]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving || (paymentHandle.length > 0 && !isValidUpi)}
          >
            {saving ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Save Payment Handle</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    borderWidth: 1,
    gap: Spacing.md,
  },
  cardTitle: { ...Typography.headlineLgMobile, fontSize: 18 },
  cardSub: { ...Typography.bodyMd, fontSize: 13 },
  validationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginLeft: 4,
  },
  validationText: {
    ...Typography.bodySm,
    fontWeight: '600',
  },
  defaultToggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.xs },
  defaultToggleText: { ...Typography.bodyMd, flex: 1 },
  button: {
    width: '100%',
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.button,
  },
  disabledButton: { opacity: 0.7 },
  buttonText: { ...Typography.titleMd },
});
