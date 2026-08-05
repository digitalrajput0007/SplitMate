import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpSupport'>;

const FAQS = [
  {
    q: 'How does SplitMate simplify group debts?',
    a: 'SplitMate calculates the net balance for every member in your group across all expenses and settlements. It then matches debtors and creditors using a greedy algorithm to reduce crisscrossing payments into the minimum direct transfers possible.',
  },
  {
    q: 'How do UPI settle-ups work?',
    a: 'When you tap "Pay via UPI", SplitMate creates a standard upi://pay deep link intent pre-filled with the payee VPA and exact settlement amount. This opens installed UPI apps like Google Pay, PhonePe, or Paytm automatically.',
  },
  {
    q: 'Are my group expenses synced in real-time?',
    a: 'Yes! All groups, member balance shares, expenses, and recorded settlements are stored in Cloud Firestore and update live in real-time across all group members.',
  },
  {
    q: 'Can I use non-INR currencies?',
    a: 'Absolutely! SplitMate automatically detects your region or allows you to select your preferred currency (USD $, EUR €, GBP £, etc.) in App Settings.',
  },
];

export default function HelpSupportScreen({ navigation }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const handleContactSupport = () => {
    const emailUrl = 'mailto:support@splitmate.app?subject=SplitMate%20Support%20Inquiry';
    Linking.openURL(emailUrl).catch(() => {
      Alert.alert(
        'Contact Support',
        'Please send your feedback or support inquiry to:\n\nsupport@splitmate.app'
      );
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Contact Banner */}
        <View style={styles.contactCard}>
          <MaterialIcons name="headset-mic" size={32} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.contactTitle}>Need direct assistance?</Text>
            <Text style={styles.contactSub}>Our support team is available 24/7 to help you.</Text>
          </View>
          <TouchableOpacity style={styles.contactBtn} onPress={handleContactSupport}>
            <Text style={styles.contactBtnText}>Email Us</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        <View style={styles.faqList}>
          {FAQS.map((faq, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => setExpandedIndex(isExpanded ? null : index)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                  <MaterialIcons
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={24}
                    color={Colors.primary}
                  />
                </TouchableOpacity>
                {isExpanded && <Text style={styles.faqAnswer}>{faq.a}</Text>}
              </View>
            );
          })}
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
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  contactTitle: { ...Typography.titleMd, color: Colors.onSurface, fontSize: 15 },
  contactSub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, fontSize: 12, marginTop: 2 },
  contactBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  contactBtnText: { ...Typography.titleMd, color: Colors.onPrimary, fontSize: 12 },
  sectionTitle: { ...Typography.titleMd, color: Colors.onBackground },
  faqList: { gap: Spacing.sm },
  faqItem: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  faqQuestion: { ...Typography.bodyLg, color: Colors.onSurface, flex: 1, fontWeight: '600', fontSize: 14 },
  faqAnswer: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: Spacing.sm, lineHeight: 20 },
});
