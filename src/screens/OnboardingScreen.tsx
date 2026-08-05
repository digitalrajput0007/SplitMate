import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Split Effortlessly',
    description: 'Add expenses in seconds and split equal or custom amounts with roommates and friends.',
    icon: '📊',
  },
  {
    id: '2',
    title: 'Instant UPI Settlement',
    description: 'Settle debts directly with 1-tap Google Pay, PhonePe, or Paytm deep linking.',
    icon: '💸',
  },
  {
    id: '3',
    title: 'Group Expense Tracking',
    description: 'Smart algorithms minimize the total number of transactions across all members.',
    icon: '🤝',
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);

  const handleNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      navigation.navigate('SignIn');
    }
  };

  const currentSlide = SLIDES[activeIndex];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />
      {/* Top Header / Skip */}
      <View style={styles.header}>
        <Text style={[styles.brandTitle, { color: colors.primary }]}>SplitMate</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
          <Text style={[styles.skipText, { color: colors.onSurfaceVariant }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Main Slide Card */}
      <View style={styles.slideCardContainer}>
        <View style={[styles.slideCard, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <View style={[styles.illustrationBox, { backgroundColor: colors.primaryContainer }]}>
            <Text style={styles.illustrationEmoji}>{currentSlide.icon}</Text>
          </View>
          <Text style={[styles.title, { color: colors.onSurface }]}>{currentSlide.title}</Text>
          <Text style={[styles.description, { color: colors.onSurfaceVariant }]}>{currentSlide.description}</Text>
        </View>
      </View>

      {/* Footer Indicators & CTA */}
      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setActiveIndex(index)}
              style={[
                styles.dot,
                { backgroundColor: index === activeIndex ? colors.primary : colors.outlineVariant },
                index === activeIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={[styles.nextButtonText, { color: colors.onPrimary }]}>
            {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
  },
  brandTitle: {
    ...Typography.titleMd,
  },
  skipText: {
    ...Typography.bodyMd,
  },
  slideCardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.containerMargin,
  },
  slideCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.card,
    borderWidth: 1,
  },
  illustrationBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  illustrationEmoji: {
    fontSize: 56,
  },
  title: {
    ...Typography.headlineLgMobile,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    ...Typography.bodyMd,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: Spacing.containerMargin,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
  },
  nextButton: {
    width: '100%',
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  nextButtonText: {
    ...Typography.titleMd,
  },
});
