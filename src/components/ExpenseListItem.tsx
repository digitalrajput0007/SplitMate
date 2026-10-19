import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing, BorderRadius } from '../theme';
import { formatCurrency } from '../services/currencyService';

export interface ExpenseListItemProps {
  id?: string;
  title: string;
  category?: string;
  amount: number;
  date: string;
  groupName?: string;
  payerName?: string;
  isPaidByCurrentUser?: boolean;
  userShareAmount?: number;
  onPress?: () => void;
}

const CATEGORY_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  Food: 'restaurant',
  Dining: 'restaurant',
  Groceries: 'shopping-cart',
  Shopping: 'shopping-bag',
  Transport: 'directions-car',
  Travel: 'flight',
  Entertainment: 'movie',
  Bills: 'receipt',
  Utilities: 'bolt',
  Rent: 'apartment',
  Medical: 'local-hospital',
  General: 'receipt-long',
  Other: 'category',
};

const CATEGORY_COLORS: Record<string, string> = {
  Food: '#F97316',
  Dining: '#F97316',
  Groceries: '#10B981',
  Shopping: '#EC4899',
  Transport: '#3B82F6',
  Travel: '#06B6D4',
  Entertainment: '#8B5CF6',
  Bills: '#EAB308',
  Utilities: '#EAB308',
  Rent: '#6366F1',
  Medical: '#EF4444',
  General: '#0284C7',
  Other: '#64748B',
};

export function ExpenseListItem({
  title,
  category = 'General',
  amount,
  date,
  groupName,
  payerName,
  isPaidByCurrentUser,
  userShareAmount,
  onPress,
}: ExpenseListItemProps) {
  const { colors, isDark } = useTheme();

  const iconName = CATEGORY_ICONS[category] || 'receipt-long';
  const iconColor = CATEGORY_COLORS[category] || colors.primary;

  // Visual status of user's involvement
  const lentMoney = isPaidByCurrentUser;
  const netAmount = userShareAmount !== undefined ? userShareAmount : amount;

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
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Category Icon */}
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F0F9FF',
          },
        ]}
      >
        <MaterialIcons name={iconName} size={22} color={iconColor} />
      </View>

      {/* Info Column */}
      <View style={styles.infoCol}>
        <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          {groupName ? (
            <Text style={[styles.metaText, { color: colors.primary }]} numberOfLines={1}>
              {groupName} •{' '}
            </Text>
          ) : null}
          <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]}>
            {date}
          </Text>
        </View>
        {payerName ? (
          <Text style={[styles.payerText, { color: colors.outline }]} numberOfLines={1}>
            {isPaidByCurrentUser ? 'You paid' : `Paid by ${payerName}`}
          </Text>
        ) : null}
      </View>

      {/* Amount Column */}
      <View style={styles.amountCol}>
        <Text style={[styles.totalAmount, { color: colors.onSurface }]}>
          {formatCurrency(amount)}
        </Text>
        {userShareAmount !== undefined ? (
          <Text
            style={[
              styles.shareText,
              { color: lentMoney ? colors.positive : colors.error },
            ]}
          >
            {lentMoney ? `+${formatCurrency(netAmount)}` : `-${formatCurrency(netAmount)}`}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  title: {
    ...Typography.titleSm,
    fontWeight: '600',
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...Typography.bodySm,
    fontSize: 12,
  },
  payerText: {
    ...Typography.bodySm,
    fontSize: 11,
    marginTop: 1,
  },
  amountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  totalAmount: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
  shareText: {
    ...Typography.bodySm,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
