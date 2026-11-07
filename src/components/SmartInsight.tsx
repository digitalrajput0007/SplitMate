import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { MonthlyInsights, ExpenseData, SettlementData } from '../services/firestoreService';
import { formatCurrency } from '../services/currencyService';

export interface SmartInsightProps {
  insights: MonthlyInsights;
  expenses?: ExpenseData[];
  settlements?: SettlementData[];
  onPress?: () => void;
}

export function SmartInsight({ insights, onPress }: SmartInsightProps) {
  const { colors } = useTheme();

  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });
  const hasSpending = (insights?.totalPaid || 0) > 0;
  const hasReceived = (insights?.totalReceived || 0) > 0;
  const largest = insights?.largestExpense;
  const hasLargest = !!(largest && largest.amount > 0 && largest.title && largest.title !== 'None');

  // Generate dynamic contextual insight text
  let insightText = `No shared expenses recorded for ${currentMonthName} yet.`;
  if (hasLargest) {
    insightText = `Largest spend: "${largest.title}" (${formatCurrency(largest.amount)})`;
  } else if (hasSpending && hasReceived) {
    insightText = `You've paid ${formatCurrency(insights.totalPaid)} and recovered ${formatCurrency(insights.totalReceived)} this month.`;
  } else if (hasSpending) {
    insightText = `You've contributed ${formatCurrency(insights.totalPaid)} across your groups this month.`;
  } else if (hasReceived) {
    insightText = `You've received ${formatCurrency(insights.totalReceived)} in settlements this month.`;
  }

  const activeGroupsLabel = insights?.activeGroupsCount
    ? `${insights.activeGroupsCount} active group${insights.activeGroupsCount !== 1 ? 's' : ''}`
    : 'No active groups';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.divider,
        },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      accessibilityRole="button"
      accessibilityLabel={`${currentMonthName} spending pulse`}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryFixed }]}>
            <MaterialIcons name="insights" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>
            {currentMonthName} Spending Pulse
          </Text>
        </View>

        {onPress && (
          <View style={styles.actionLink}>
            <Text style={[styles.actionText, { color: colors.primary }]}>Analytics</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        )}
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        {/* Paid / Outflow Metric */}
        <View style={styles.metricCol}>
          <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>YOU PAID</Text>
          <Text style={[styles.metricValue, { color: colors.onSurface }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(insights?.totalPaid || 0)}
          </Text>
          <Text style={[styles.metricSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
            {activeGroupsLabel}
          </Text>
        </View>

        {/* Divider */}
        <View style={[styles.metricDivider, { backgroundColor: colors.divider }]} />

        {/* Received / Recovered Metric */}
        <View style={styles.metricCol}>
          <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>SETTLED / RECEIVED</Text>
          <Text
            style={[
              styles.metricValue,
              { color: hasReceived ? colors.positive : colors.onSurface },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(insights?.totalReceived || 0)}
          </Text>
          <Text style={[styles.metricSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
            {hasReceived ? 'Recovered' : 'Settled up'}
          </Text>
        </View>
      </View>

      {/* Highlight Insight Pill */}
      <View
        style={[
          styles.insightPill,
          {
            backgroundColor: colors.surfaceContainerLow,
            borderColor: colors.divider,
          },
        ]}
      >
        <MaterialIcons name="lightbulb" size={16} color={colors.primary} style={{ marginTop: 1 }} />
        <Text style={[styles.insightPillText, { color: colors.onSurface }]} numberOfLines={2}>
          {insightText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.sm + 2,
    ...Shadows.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.titleSm,
    fontWeight: '700',
    fontSize: 14,
  },
  actionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionText: {
    ...Typography.labelMd,
    fontSize: 12,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  metricCol: {
    flex: 1,
    gap: 2,
  },
  metricDivider: {
    width: 1,
    height: '80%',
    marginHorizontal: Spacing.sm,
  },
  metricLabel: {
    ...Typography.labelMd,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  metricValue: {
    ...Typography.titleLg,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  metricSub: {
    ...Typography.bodySm,
    fontSize: 11,
  },
  insightPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 3,
    borderRadius: BorderRadius.md,
    borderWidth: 0.5,
  },
  insightPillText: {
    ...Typography.bodySm,
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
});
