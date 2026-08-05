import React from 'react';
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
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';

export default function ContactUsScreen() {
  const navigation = useNavigation();

  const handleEmailPress = () => {
    Linking.openURL('mailto:support@splitmate.app?subject=Support%20Request').catch(() => {
      Alert.alert('Error', 'Unable to open email client.');
    });
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
        <Text style={styles.topBarTitle}>Contact Us</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Support Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconBox}>
            <Text style={{ fontSize: 28 }}>💬</Text>
          </View>
          <Text style={styles.heroTitle}>We're here to help</Text>
          <Text style={styles.heroSub}>
            Have questions about a split balance or experiencing an issue? Get in touch with our team.
          </Text>
        </View>

        {/* Contact Options */}
        <Text style={styles.sectionTitle}>Get in Touch</Text>

        <TouchableOpacity style={styles.optionCard} onPress={handleEmailPress} activeOpacity={0.85}>
          <View style={[styles.optionIcon, { backgroundColor: '#E3F2FD' }]}>
            <Text style={{ fontSize: 20 }}>✉️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>Email Support</Text>
            <Text style={styles.optionSub}>support@splitmate.app</Text>
          </View>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.onSurfaceVariant} strokeWidth="2">
            <Path d="M9 18l6-6-6-6" />
          </Svg>
        </TouchableOpacity>
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
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.md },
  heroCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  heroTitle: { ...Typography.headlineLgMobile, color: Colors.onSurface, fontWeight: '600' },
  heroSub: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, textAlign: 'center' },
  sectionTitle: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600', marginTop: Spacing.xs },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
  optionSub: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
});
