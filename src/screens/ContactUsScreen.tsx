import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  StatusBar as RNStatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export default function ContactUsScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const handleEmailPress = () => {
    Linking.openURL('mailto:support@splitmate.app?subject=Support%20Request').catch(() => {
      Alert.alert('Error', 'Unable to open email client.');
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.onBackground} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>Contact Us</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Support Card */}
        <View style={[styles.heroCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <View style={[styles.heroIconBox, { backgroundColor: colors.primaryFixed }]}>
            <MaterialIcons name="support-agent" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.onSurface }]}>We're here to help</Text>
          <Text style={[styles.heroSub, { color: colors.onSurfaceVariant }]}>
            Have questions about a split balance or experiencing an issue? Get in touch with our team.
          </Text>
        </View>

        {/* Contact Options */}
        <Text style={[styles.sectionTitle, { color: colors.onBackground }]}>Get in Touch</Text>

        <TouchableOpacity style={[styles.optionCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]} onPress={handleEmailPress} activeOpacity={0.85}>
          <View style={[styles.optionIcon, { backgroundColor: colors.surfaceContainerLow }]}>
            <MaterialIcons name="email" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, { color: colors.onSurface }]}>Email Support</Text>
            <Text style={[styles.optionSub, { color: colors.onSurfaceVariant }]}>support@splitmate.app</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.outlineVariant} />
        </TouchableOpacity>
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
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl, gap: Spacing.md },
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    ...Shadows.card,
  },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  heroTitle: { ...Typography.headlineLgMobile, fontWeight: '600' },
  heroSub: { ...Typography.bodyMd, textAlign: 'center' },
  sectionTitle: { ...Typography.titleMd, fontWeight: '600', marginTop: Spacing.xs },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    ...Shadows.card,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { ...Typography.titleSm, fontWeight: '600' },
  optionSub: { ...Typography.labelMd, marginTop: 2 },
});
