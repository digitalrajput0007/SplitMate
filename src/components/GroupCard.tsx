import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface GroupCardProps {
  name: string;
  groupPhotoUrl?: string;
  groupType?: 'Trip' | 'Family' | 'Couple' | 'Flatmate' | 'Home' | 'Other';
  members: Array<{ name: string; uri?: string }>;
  balanceLabel: 'owed' | 'owe' | 'settled';
  balanceAmount: string;
  onPress: () => void;
  role?: 'owner' | 'member';
  lastActivity?: string;
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
  role,
  lastActivity,
}: GroupCardProps) {
  const { colors } = useTheme();
  const [imgError, setImgError] = React.useState(false);
  const isPositive = balanceLabel === 'owed';
  const isNegative = balanceLabel === 'owe';

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
        {/* Group Photo or Icon */}
        <View style={[styles.groupBadgeCircle, { backgroundColor: colors.primaryContainer }]}>
          {groupPhotoUrl && !imgError ? (
            <Image
              source={{ uri: groupPhotoUrl }}
              style={styles.groupBadgeImage}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={[styles.groupBadgeFallback, { backgroundColor: colors.primaryFixed }]}>
              <MaterialIcons name={iconName} size={28} color={colors.primary} />
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.groupName, { color: colors.onSurface }]} numberOfLines={1}>
              {name}
            </Text>
            {role && (
              <View style={[styles.roleBadge, { backgroundColor: role === 'owner' ? colors.primaryContainer : colors.surfaceContainerHigh }]}>
                <Text style={[styles.roleText, { color: role === 'owner' ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                  {role === 'owner' ? 'Owner' : 'Member'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]}>
              {groupType || 'Other'} • {members.length} members
            </Text>
          </View>

          {lastActivity && (
            <Text style={[styles.lastActivity, { color: colors.outline }]}>
              {lastActivity}
            </Text>
          )}

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
                      {m.name && m.name !== 'Member' ? m.name.charAt(0).toUpperCase() : '?'}
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

        {/* Balance Section */}
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
    marginBottom: Spacing.xs,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  groupBadgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  info: {
    flex: 1,
    gap: 2,
    marginRight: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupName: {
    ...Typography.titleMd,
    fontWeight: 'bold',
    maxWidth: '65%',
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    ...Typography.labelMd,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    ...Typography.bodySm,
    fontSize: 11,
  },
  lastActivity: {
    ...Typography.bodySm,
    fontSize: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avatarWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
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
    fontSize: 9,
    fontWeight: '600',
  },
  moreAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 8,
    fontWeight: '500',
  },
  balanceSection: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  balanceLabelText: {
    ...Typography.labelMd,
    fontSize: 10,
  },
  balanceAmountText: {
    ...Typography.titleMd,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
