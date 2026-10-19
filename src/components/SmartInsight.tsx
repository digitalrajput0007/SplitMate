import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { MonthlyInsights, ExpenseData, SettlementData } from '../services/firestoreService';

export interface SmartInsightProps {
  insights: MonthlyInsights;
  expenses: ExpenseData[];
  settlements: SettlementData[];
}

const { width } = Dimensions.get('window');
// Assume container margin is 16 on each side
const CARD_WIDTH = width - 32;

export function SmartInsight({ insights, expenses, settlements }: SmartInsightProps) {
  const { colors } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const generatedInsights = [
    {
      id: 'insight_1',
      icon: 'trending-up',
      title: 'Spending Pattern',
      message: `Your largest expense this month was "${insights.largestExpense.title}" for ${insights.largestExpense.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}.`
    },
    {
      id: 'insight_2',
      icon: 'groups',
      title: 'Active Engagement',
      message: `You are active in ${insights.activeGroupsCount} group${insights.activeGroupsCount !== 1 ? 's' : ''} this month.`
    },
    {
      id: 'insight_3',
      icon: 'savings',
      title: 'Monthly Volume',
      message: `You've paid out ${insights.totalPaid.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} and received ${insights.totalReceived.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} so far.`
    }
  ];

  const startAutoPlay = () => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(() => {
      setActiveIndex((prev) => {
        const nextIndex = (prev + 1) % generatedInsights.length;
        scrollViewRef.current?.scrollTo({ x: nextIndex * CARD_WIDTH, animated: true });
        return nextIndex;
      });
    }, 6000);
  };

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, []);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== activeIndex) {
      setActiveIndex(roundIndex);
    }
  };

  const handleScrollBeginDrag = () => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
  };

  const handleScrollEndDrag = () => {
    startAutoPlay();
  };

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.surfaceContainerLowest }]}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
      >
        {generatedInsights.map((item) => (
          <View key={item.id} style={[styles.card, { width: CARD_WIDTH }]}>
            <View style={[styles.iconBox, { backgroundColor: colors.primaryFixed }]}>
              <MaterialIcons name={item.icon as any} size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.onSurfaceVariant }]}>{item.title}</Text>
              <Text style={[styles.message, { color: colors.onSurface }]}>{item.message}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
      
      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {generatedInsights.map((_, i) => (
          <View
            key={`dot_${i}`}
            style={[
              styles.dot,
              { backgroundColor: i === activeIndex ? colors.primary : colors.surfaceVariant }
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: BorderRadius.xl,
    paddingBottom: Spacing.sm,
    ...Shadows.cardElevated,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.lg,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.titleSm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    ...Typography.bodyMd,
    lineHeight: 20,
    opacity: 0.9,
  }
});
