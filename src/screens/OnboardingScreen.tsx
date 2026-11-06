import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, BorderRadius, Typography } from '../theme';
import { useTheme } from '../context/ThemeContext';
import AppLogo from '../components/AppLogo';
import {
  OnboardingIllustration,
  SplitMateIllustrationType,
} from '../components/OnboardingIllustration';

export const ONBOARDING_COMPLETED_KEY = '@splitmate_onboarding_completed_v1';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  illustrationType: SplitMateIllustrationType;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  headline: string;
  description: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    illustrationType: 'split',
    badge: 'EFFORTLESS SPLITTING',
    badgeColor: '#0284C7',
    badgeBg: '#E0F2FE',
    headline: 'Split expenses in seconds',
    description: 'Add bills easily and split equally or with custom amounts among friends and roommates.',
  },
  {
    id: '2',
    illustrationType: 'settle',
    badge: '1-TAP UPI SETTLEMENT',
    badgeColor: '#059669',
    badgeBg: '#D1FAE5',
    headline: 'Settle debts instantly',
    description: 'Direct 1-tap deep links to Google Pay, PhonePe, or Paytm with automatic payment verification.',
  },
  {
    id: '3',
    illustrationType: 'groups',
    badge: 'SMART GROUP TRACKING',
    badgeColor: '#4F46E5',
    badgeBg: '#EEF2FF',
    headline: 'Minimize group transactions',
    description: 'Intelligent balance algorithms simplify debts across all members so you settle with minimal payments.',
  },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch (e) {
      // Storage fallback
    }
    navigation.replace('SignIn');
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const onMomentumScrollEnd = (e: any) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 12) + Spacing.sm;
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + Spacing.md;

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Top Header with Brand and Skip button */}
      <View style={[styles.topHeader, { paddingTop: topPadding }]}>
        <View style={styles.brandRow}>
          <AppLogo size={36} />
          <Text style={[styles.brandText, { color: colors.onBackground }]}>SplitMate</Text>
        </View>

        {!isLastSlide ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleSkip}
            style={styles.skipButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.skipText, { color: colors.onSurfaceVariant }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      {/* Swipeable Carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item }) => (
          <View style={[styles.slideContainer, { width }]}>
            {/* Interactive Vector Illustration */}
            <View style={styles.illustrationWrapper}>
              <OnboardingIllustration type={item.illustrationType} />
              <View style={[styles.badgePill, { backgroundColor: item.badgeBg }]}>
                <Text style={[styles.badgeText, { color: item.badgeColor }]}>{item.badge}</Text>
              </View>
            </View>

            {/* Slide Text Content */}
            <View style={styles.textSection}>
              <Text style={[styles.headline, { color: colors.onBackground }]}>
                {item.headline}
              </Text>
              <Text style={[styles.description, { color: colors.onSurfaceVariant }]}>
                {item.description}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Bottom Controls Area */}
      <View style={[styles.bottomArea, { paddingBottom: bottomPadding }]}>
        {/* Pagination Dots */}
        <View style={styles.paginationRow}>
          {SLIDES.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => {
                flatListRef.current?.scrollToIndex({ index: idx, animated: true });
                setCurrentIndex(idx);
              }}
              style={[
                styles.dot,
                {
                  backgroundColor: idx === currentIndex ? colors.primary : colors.outlineVariant,
                  width: idx === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleNext}
          style={[
            styles.actionButton,
            { backgroundColor: colors.primary },
          ]}
        >
          <Text style={[styles.actionButtonText, { color: colors.onPrimary }]}>
            {isLastSlide ? 'Get Started' : 'Next'}
          </Text>
          <MaterialIcons
            name={isLastSlide ? 'check' : 'arrow-forward'}
            size={20}
            color={colors.onPrimary}
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Platform.OS === 'android' ? Spacing.lg : Spacing.sm,
    paddingBottom: Spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    ...Typography.titleLg,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  skipText: {
    ...Typography.bodyMd,
    fontWeight: '600',
  },
  slideContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationWrapper: {
    width: width - 48,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  badgePill: {
    marginTop: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  textSection: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  headline: {
    ...Typography.headlineLg,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
    lineHeight: 34,
  },
  description: {
    ...Typography.bodyMd,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  bottomArea: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'android' ? 48 : Spacing.xxl,
    paddingTop: Spacing.md,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionButton: {
    height: 54,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
