import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { MonthlyInsights, ExpenseData, SettlementData } from '../services/firestoreService';

export interface SmartInsightProps {
  insights: MonthlyInsights;
  expenses: ExpenseData[];
  settlements: SettlementData[];
}

export function SmartInsight({ insights, expenses, settlements }: SmartInsightProps) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const fadeAnim = useState(new Animated.Value(1))[0];

  const generatedInsights = [
    {
      icon: 'trending-up',
      title: 'Spending Pattern',
      message: `Your largest expense this month was "${insights.largestExpense.title}" for ${insights.largestExpense.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}.`
    },
    {
      icon: 'groups',
      title: 'Active Engagement',
      message: `You are active in ${insights.activeGroupsCount} group${insights.activeGroupsCount !== 1 ? 's' : ''} this month.`
    },
    {
      icon: 'savings',
      title: 'Monthly Volume',
      message: `You've paid out ${insights.totalPaid.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} and received ${insights.totalReceived.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })} so far.`
    }
  ];

  // Rotate every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      // 1. Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true
      }).start(() => {
        // 2. Change content while invisible
        setIndex((prev) => (prev + 1) % generatedInsights.length);

        // 3. Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        }).start();
      });
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const item = generatedInsights[index];

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.divider }]}>
      <Animated.View style={{ opacity: fadeAnim, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={[styles.iconBox, { backgroundColor: colors.primaryFixed }]}>
          <MaterialIcons name={item.icon as any} size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.onSurfaceVariant }]}>{item.title}</Text>
          <Text style={[styles.message, { color: colors.onSurface }]}>{item.message}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    ...Shadows.card,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.labelMd,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  message: {
    ...Typography.bodyMd,
    marginTop: 2,
    lineHeight: 18,
  }
});
