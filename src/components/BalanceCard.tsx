import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, RadialGradient as SVGRadialGradient, Stop } from 'react-native-svg';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';
import { formatCurrency } from '../services/currencyService';

interface BalanceCardProps {
  totalBalance: number;
  youAreOwed: number;
  youOwe: number;
  onSettlePress?: () => void;
  onWalletPress?: () => void;
}

export function BalanceCard({
  totalBalance,
  youAreOwed,
  youOwe,
  onSettlePress,
  onWalletPress,
}: BalanceCardProps) {
  const isPositive = totalBalance > 0;
  const isNegative = totalBalance < 0;

  return (
    <LinearGradient
      colors={['#075985', '#0284C7', '#0369A1']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Background ambient radial circles */}
      <View style={StyleSheet.absoluteFill}>
        <Svg height="100%" width="100%">
          <Defs>
            <SVGRadialGradient id="skyGrad1" cx="80%" cy="20%" rx="60%" ry="60%">
              <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
              <Stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
            </SVGRadialGradient>
            <SVGRadialGradient id="skyGrad2" cx="20%" cy="90%" rx="60%" ry="60%">
              <Stop offset="0%" stopColor="#BAE6FD" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#0369A1" stopOpacity="0" />
            </SVGRadialGradient>
          </Defs>
          <Circle cx="85%" cy="20%" r="130" fill="url(#skyGrad1)" />
          <Circle cx="15%" cy="85%" r="120" fill="url(#skyGrad2)" />
        </Svg>
      </View>

      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          <MaterialIcons name="account-balance-wallet" size={16} color="#BAE6FD" />
          <Text style={styles.badgeText}>TOTAL NET BALANCE</Text>
        </View>

        {onWalletPress ? (
          <TouchableOpacity style={styles.walletBtn} onPress={onWalletPress} activeOpacity={0.75}>
            <Ionicons name="card-outline" size={18} color="#E0F2FE" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Primary Amount Display */}
      <View style={styles.amountContainer}>
        <Text style={styles.amountValue}>
          {totalBalance === 0
            ? formatCurrency(0)
            : totalBalance > 0
            ? `+${formatCurrency(totalBalance)}`
            : `-${formatCurrency(Math.abs(totalBalance))}`}
        </Text>
      </View>

      <Text style={styles.statusDescription}>
        {isPositive
          ? 'Overall you are owed money'
          : isNegative
          ? 'Overall you owe money'
          : 'All settled up! No debts pending'}
      </Text>

      {/* Breakdown Row */}
      <View style={styles.breakdownRow}>
        {/* You are owed */}
        <View style={styles.breakdownPill}>
          <View style={[styles.dotIndicator, { backgroundColor: '#4ADE80' }]} />
          <View>
            <Text style={styles.breakdownLabel}>You are owed</Text>
            <Text style={styles.breakdownPositive}>{formatCurrency(youAreOwed)}</Text>
          </View>
        </View>

        <View style={styles.dividerVertical} />

        {/* You owe */}
        <View style={styles.breakdownPill}>
          <View style={[styles.dotIndicator, { backgroundColor: '#F87171' }]} />
          <View>
            <Text style={styles.breakdownLabel}>You owe</Text>
            <Text style={styles.breakdownNegative}>{formatCurrency(youOwe)}</Text>
          </View>
        </View>
      </View>

      {/* CTA Button */}
      {onSettlePress ? (
        <TouchableOpacity
          style={styles.settleBtn}
          onPress={onSettlePress}
          activeOpacity={0.85}
        >
          <Ionicons name="swap-horizontal" size={18} color="#082F49" />
          <Text style={styles.settleBtnText}>Settlement Center</Text>
        </TouchableOpacity>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.cardElevated,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontFamily: Typography.fontFamilySemiBold,
    letterSpacing: 0.8,
  },
  walletBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: Spacing.xs,
  },
  amountPrefix: {
    fontSize: 32,
    color: '#F8FAFC',
    fontFamily: Typography.fontFamilyBold,
  },
  amountValue: {
    fontSize: 36,
    color: '#FFFFFF',
    fontFamily: Typography.fontFamilyBold,
    letterSpacing: -0.6,
  },
  statusDescription: {
    color: '#BAE6FD',
    fontSize: 13,
    fontFamily: Typography.fontFamilyMedium,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    justifyContent: 'space-between',
  },
  breakdownPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    color: '#BAE6FD',
    fontSize: 11,
    fontFamily: Typography.fontFamily,
  },
  breakdownPositive: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Typography.fontFamilyBold,
  },
  breakdownNegative: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Typography.fontFamilyBold,
  },
  dividerVertical: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 4,
  },
  settleBtn: {
    marginTop: Spacing.md,
    backgroundColor: '#F0F9FF',
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  settleBtnText: {
    color: '#0369A1',
    fontFamily: Typography.fontFamilyBold,
    fontSize: 14,
  },
});
