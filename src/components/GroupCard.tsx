import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';

interface GroupCardProps {
  name: string;
  members: Array<{ name: string; uri?: string }>;
  balanceLabel: 'owed' | 'owe' | 'settled';
  balanceAmount: string;
  onPress: () => void;
}

export function GroupCard({
  name,
  members,
  balanceLabel,
  balanceAmount,
  onPress,
}: GroupCardProps) {
  const isPositive = balanceLabel === 'owed';
  const isNegative = balanceLabel === 'owe';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {/* Title and Avatars */}
        <View style={styles.info}>
          <Text style={styles.groupName} numberOfLines={1}>{name}</Text>
          <View style={styles.avatarRow}>
            {members.slice(0, 4).map((m, i) => (
              <View
                key={i}
                style={[
                  styles.avatarWrapper,
                  { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i },
                ]}
              >
                {m.uri ? (
                  <Image source={{ uri: m.uri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
              </View>
            ))}
            {members.length > 4 && (
              <View style={[styles.avatarWrapper, styles.moreAvatar, { marginLeft: -8 }]}>
                <Text style={styles.moreText}>+{members.length - 4}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Balance Status */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabelText}>
            {balanceLabel === 'settled' ? 'Settled Up' : balanceLabel === 'owed' ? 'You are owed' : 'You owe'}
          </Text>
          <Text
            style={[
              styles.balanceAmountText,
              isPositive && styles.positiveAmount,
              isNegative && styles.negativeAmount,
              balanceLabel === 'settled' && styles.settledAmount,
            ]}
          >
            {balanceAmount}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    flex: 1,
    gap: Spacing.sm,
    marginRight: Spacing.md,
  },
  groupName: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.surfaceContainerLowest,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.labelMd,
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
  },
  moreAvatar: {
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    ...Typography.labelMd,
    fontSize: 10,
    color: Colors.onSurfaceVariant,
    fontWeight: '500',
  },
  balanceSection: {
    alignItems: 'flex-end',
  },
  balanceLabelText: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
  },
  balanceAmountText: {
    ...Typography.titleMd,
    fontWeight: '600',
    marginTop: 2,
  },
  positiveAmount: {
    color: Colors.positive,
  },
  negativeAmount: {
    color: Colors.error,
  },
  settledAmount: {
    color: Colors.outline,
  },
});
