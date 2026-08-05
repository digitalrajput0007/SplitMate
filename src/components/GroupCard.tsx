import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface GroupCardProps {
  name: string;
  groupPhotoUrl?: string;
  groupType?: 'Trip' | 'Family' | 'Couple' | 'Flatmate' | 'Home' | 'Other';
  members: Array<{ name: string; uri?: string }>;
  balanceLabel: 'owed' | 'owe' | 'settled';
  balanceAmount: string;
  onPress: () => void;
}

const TYPE_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  Trip: 'flight',
  Family: 'home',
  Couple: 'favorite',
  Flatmate: 'apartment',
  Other: 'groups',
};

export function GroupCard({
  name,
  groupPhotoUrl,
  groupType,
  members,
  balanceLabel,
  balanceAmount,
  onPress,
}: GroupCardProps) {
  const { colors } = useTheme();
  const [imgError, setImgError] = React.useState(false);
  const isPositive = balanceLabel === 'owed';
  const isNegative = balanceLabel === 'owe';

  const groupInitial = name ? name.trim().charAt(0).toUpperCase() : 'G';
  const iconName = groupType && TYPE_ICONS[groupType] ? TYPE_ICONS[groupType] : 'groups';

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
    >
      <View style={styles.content}>
        {/* Group Photo or Icon / Initial Badge */}
        <View style={[styles.groupBadgeCircle, { backgroundColor: colors.primaryContainer }]}>
          {groupPhotoUrl && !imgError ? (
            <Image
              source={{ uri: groupPhotoUrl }}
              style={styles.groupBadgeImage}
              resizeMode="cover"
              onError={(e) => {
                console.log('Group image failed to load:', e.nativeEvent.error);
                setImgError(true);
              }}
            />
          ) : (
            <View style={[styles.groupBadgeFallback, { backgroundColor: colors.primaryFixed }]}>
              <MaterialIcons name={iconName} size={22} color={colors.primary} />
            </View>
          )}
        </View>

        {/* Title and Avatars */}
        <View style={styles.info}>
          <Text style={[styles.groupName, { color: colors.onSurface }]} numberOfLines={1}>{name}</Text>
          <View style={styles.avatarRow}>
            {members.slice(0, 4).map((m, i) => (
              <View
                key={i}
                style={[
                  styles.avatarWrapper,
                  {
                    marginLeft: i === 0 ? 0 : -8,
                    zIndex: 10 - i,
                    borderColor: colors.surfaceContainerLowest,
                  },
                ]}
              >
                {m.uri ? (
                  <Image source={{ uri: m.uri }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: colors.primaryFixed }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {m.name && m.name !== 'Member' ? m.name.trim().charAt(0).toUpperCase() : '?'}
                    </Text>
                  </View>
                )}
              </View>
            ))}
            {members.length > 4 && (
              <View
                style={[
                  styles.avatarWrapper,
                  styles.moreAvatar,
                  {
                    marginLeft: -8,
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: colors.surfaceContainerLowest,
                  },
                ]}
              >
                <Text style={[styles.moreText, { color: colors.onSurfaceVariant }]}>+{members.length - 4}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Balance Status */}
        <View style={styles.balanceSection}>
          <Text style={[styles.balanceLabelText, { color: colors.onSurfaceVariant }]}>
            {balanceLabel === 'settled' ? 'Settled Up' : balanceLabel === 'owed' ? 'You are owed' : 'You owe'}
          </Text>
          <Text
            style={[
              styles.balanceAmountText,
              isPositive && { color: colors.positive },
              isNegative && { color: colors.error },
              balanceLabel === 'settled' && { color: colors.outline },
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
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.card,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  groupBadgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  groupBadgeFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBadgeImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  groupBadgeText: {
    ...Typography.titleLg,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
    marginRight: Spacing.sm,
  },
  groupName: {
    ...Typography.titleMd,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.labelMd,
    fontSize: 11,
    fontWeight: '600',
  },
  moreAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    ...Typography.labelMd,
    fontSize: 10,
    fontWeight: '500',
  },
  balanceSection: {
    alignItems: 'flex-end',
  },
  balanceLabelText: {
    ...Typography.labelMd,
  },
  balanceAmountText: {
    ...Typography.titleMd,
    fontWeight: '600',
    marginTop: 2,
  },
});
