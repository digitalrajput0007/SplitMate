import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatCurrency } from '../../services/firestoreService';
import { Spacing, BorderRadius, Typography } from '../../constants/theme';
import { LightColors } from '../../theme';
import { SmartImage } from '../SmartImage';

export interface GroupSpendingItem {
  groupId: string;
  groupName: string;
  groupPhotoUrl?: string;
  groupPhotoThumbnailUrl?: string;
  members: Array<{ uid?: string; name: string; photoUrl?: string; photoThumbnailUrl?: string }>;
  totalSpend: number;
  userShare: number;
  balance: number;
}

interface HorizontalBarChartProps {
  data: GroupSpendingItem[];
  colors: typeof LightColors;
  isDark: boolean;
  emptyLabel?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  colors,
  isDark,
  emptyLabel = 'No groups with spending in this period',
}) => {
  const maxSpend = Math.max(...data.map((d) => d.totalSpend), 1);

  if (data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {data.map((item) => {
        const widthPercent =
          item.totalSpend > 0
            ? Math.min(100, Math.max(5, Math.round((item.totalSpend / maxSpend) * 100)))
            : 0;

        const visibleMembers = item.members.slice(0, 4);
        const remainingMembersCount = item.members.length - visibleMembers.length;

        return (
          <View
            key={item.groupId}
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? colors.surfaceContainerLow
                  : colors.surfaceContainerLowest,
                borderColor: colors.divider,
              },
            ]}
          >
            {/* Top row: Group Photo, Name, Member Avatars, Total Spend */}
            <View style={styles.topRow}>
              <View style={styles.leftInfoWrap}>
                {/* Group Photo / Icon */}
                <SmartImage
                  uri={item.groupPhotoUrl}
                  thumbnailUri={item.groupPhotoThumbnailUrl}
                  name={item.groupName}
                  size={40}
                  fallbackIcon="groups"
                  style={styles.groupAvatar}
                />

                <View style={styles.groupMetaWrap}>
                  <Text
                    style={[styles.groupName, { color: colors.onSurface }]}
                    numberOfLines={2}
                  >
                    {item.groupName}
                  </Text>

                  {/* Overlapping member profile avatars */}
                  {item.members.length > 0 && (
                    <View style={styles.avatarStack}>
                      {visibleMembers.map((m, idx) => (
                        <View
                          key={m.uid || idx}
                          style={[
                            styles.avatarStackItem,
                            {
                              borderColor: isDark
                                ? colors.surfaceContainerLow
                                : colors.surfaceContainerLowest,
                              zIndex: 10 - idx,
                              marginLeft: idx === 0 ? 0 : -7,
                            },
                          ]}
                        >
                          <SmartImage
                            uri={m.photoUrl}
                            thumbnailUri={m.photoThumbnailUrl}
                            name={m.name}
                            size={18}
                            fallbackIcon="person"
                          />
                        </View>
                      ))}

                      {remainingMembersCount > 0 && (
                        <View
                          style={[
                            styles.avatarMoreBadge,
                            {
                              backgroundColor: colors.surfaceContainerHigh,
                              borderColor: isDark
                                ? colors.surfaceContainerLow
                                : colors.surfaceContainerLowest,
                              marginLeft: -7,
                              zIndex: 1,
                            },
                          ]}
                        >
                          <Text style={[styles.avatarMoreText, { color: colors.onSurfaceVariant }]}>
                            +{remainingMembersCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.rightSpendWrap}>
                <Text style={[styles.totalSpend, { color: colors.onSurface }]}>
                  {formatCurrency(item.totalSpend)}
                </Text>
                <Text style={[styles.spendSubtitle, { color: colors.onSurfaceVariant }]}>
                  Total spend
                </Text>
              </View>
            </View>

            {/* Horizontal Bar Track & Fill */}
            <View
              style={[
                styles.barTrack,
                {
                  backgroundColor: isDark
                    ? colors.surfaceContainerHighest
                    : colors.outlineVariant,
                },
              ]}
            >
              {widthPercent > 0 && (
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${widthPercent}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              )}
            </View>

            {/* Bottom Row: Your Share & Balance Status Badge */}
            <View style={styles.bottomRow}>
              <Text style={[styles.shareText, { color: colors.onSurfaceVariant }]}>
                Your Share:{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {formatCurrency(item.userShare)}
                </Text>
              </Text>

              <View
                style={[
                  styles.balanceBadge,
                  {
                    backgroundColor:
                      item.balance > 0
                        ? '#10B981' + '18'
                        : item.balance < 0
                        ? '#F59E0B' + '18'
                        : colors.surfaceContainerHigh,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.balanceText,
                    {
                      color:
                        item.balance > 0
                          ? '#10B981'
                          : item.balance < 0
                          ? '#F59E0B'
                          : colors.onSurfaceVariant,
                    },
                  ]}
                >
                  {item.balance > 0
                    ? `+${formatCurrency(item.balance)}`
                    : item.balance < 0
                    ? `-${formatCurrency(Math.abs(item.balance))}`
                    : 'Settled'}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    width: '100%',
  },
  card: {
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs + 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftInfoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.sm,
  },
  groupAvatar: {
    borderRadius: 20,
  },
  groupMetaWrap: {
    flex: 1,
    gap: 3,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarStackItem: {
    borderRadius: 10,
    borderWidth: 1.5,
  },
  avatarMoreBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMoreText: {
    fontSize: 9,
    fontWeight: '700',
  },
  rightSpendWrap: {
    alignItems: 'flex-end',
  },
  totalSpend: {
    fontSize: 15,
    fontWeight: '800',
  },
  spendSubtitle: {
    fontSize: 10,
    marginTop: 1,
  },
  barTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
    marginVertical: 2,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareText: {
    fontSize: 11,
  },
  balanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  balanceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
