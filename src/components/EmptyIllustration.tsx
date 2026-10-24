import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Easing, TouchableOpacity } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing, BorderRadius } from '../theme';

export type EmptyIllustrationType = 'groups' | 'contacts' | 'activity' | 'transactions';

interface EmptyStateViewProps {
  type: EmptyIllustrationType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
  compact?: boolean;
}

/**
 * Animated Empty State Vector Illustration with SplitMate Material 3 Sky-Blue design.
 * Adapts effortlessly to Light & Dark themes with ambient glow rings, floating badges, and clean iconography.
 */
export const EmptyStateIllustration: React.FC<EmptyStateViewProps> = ({
  type,
  title,
  description,
  actionLabel,
  onActionPress,
  secondaryActionLabel,
  onSecondaryActionPress,
  compact = false,
}) => {
  const { colors, isDark } = useTheme();
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [floatAnim, pulseAnim]);

  // Render specific illustrated art based on type
  const renderArt = () => {
    switch (type) {
      case 'groups':
        return (
          <View style={[styles.artBox, compact && styles.artBoxCompact]}>
            {/* Ambient Background Circles */}
            <Animated.View
              style={[
                styles.ambientCircle,
                {
                  backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.10)',
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View
              style={[
                styles.ambientCircleSecondary,
                { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.10)' : 'rgba(56, 189, 248, 0.08)' },
              ]}
            />

            {/* Central Floating Card: Groups Folder & Team Badge */}
            <Animated.View
              style={[
                styles.cardBase,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.25)' : '#E0F2FE' }]}>
                <MaterialIcons name="group-work" size={compact ? 24 : 32} color="#0284C7" />
              </View>

              {/* Mini group badges row */}
              <View style={styles.groupAvatarsRow}>
                <View style={[styles.avatarDot, { backgroundColor: '#38BDF8' }]}>
                  <Text style={styles.avatarText}>A</Text>
                </View>
                <View style={[styles.avatarDot, { backgroundColor: '#10B981', marginLeft: -8 }]}>
                  <Text style={styles.avatarText}>R</Text>
                </View>
                <View style={[styles.avatarDot, { backgroundColor: '#F59E0B', marginLeft: -8 }]}>
                  <Text style={styles.avatarText}>S</Text>
                </View>
                <View style={[styles.plusBadge, { backgroundColor: isDark ? '#334155' : '#F1F5F9', marginLeft: 6 }]}>
                  <MaterialIcons name="add" size={12} color={colors.primary} />
                </View>
              </View>
            </Animated.View>

            {/* Floating Mini Tag Badge */}
            <Animated.View
              style={[
                styles.floatingPill,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F0F9FF',
                  borderColor: isDark ? '#0284C7' : '#BAE6FD',
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              <MaterialIcons name="tag" size={12} color="#0284C7" />
              <Text style={[styles.pillText, { color: '#0284C7' }]}>Trip & Flatmates</Text>
            </Animated.View>
          </View>
        );

      case 'contacts':
        return (
          <View style={[styles.artBox, compact && styles.artBoxCompact]}>
            {/* Ambient Background Circles */}
            <Animated.View
              style={[
                styles.ambientCircle,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.10)',
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View
              style={[
                styles.ambientCircleSecondary,
                { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.10)' : 'rgba(56, 189, 248, 0.08)' },
              ]}
            />

            {/* Central Floating Card: Friend Card */}
            <Animated.View
              style={[
                styles.cardBase,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#DCFCE7' }]}>
                <Ionicons name="people" size={compact ? 24 : 32} color="#10B981" />
              </View>

              <View style={styles.contactSyncMiniRow}>
                <View style={[styles.syncStatusDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.syncStatusText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Instant 1-Tap Split
                </Text>
              </View>
            </Animated.View>

            {/* Floating Mini Tag Badge */}
            <Animated.View
              style={[
                styles.floatingPill,
                {
                  backgroundColor: isDark ? '#064E3B' : '#ECFDF5',
                  borderColor: isDark ? '#059669' : '#A7F3D0',
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              <MaterialIcons name="person-add-alt-1" size={13} color="#059669" />
              <Text style={[styles.pillText, { color: '#059669' }]}>Add from phone</Text>
            </Animated.View>
          </View>
        );

      case 'activity':
        return (
          <View style={[styles.artBox, compact && styles.artBoxCompact]}>
            {/* Ambient Background Circles */}
            <Animated.View
              style={[
                styles.ambientCircle,
                {
                  backgroundColor: isDark ? 'rgba(147, 51, 234, 0.15)' : 'rgba(147, 51, 234, 0.10)',
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View
              style={[
                styles.ambientCircleSecondary,
                { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.10)' : 'rgba(56, 189, 248, 0.08)' },
              ]}
            />

            {/* Central Floating Card: Pulse Timeline */}
            <Animated.View
              style={[
                styles.cardBase,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(147, 51, 234, 0.25)' : '#F3E8FF' }]}>
                <MaterialIcons name="notifications-active" size={compact ? 24 : 32} color="#9333EA" />
              </View>

              <View style={styles.timelineBars}>
                <View style={[styles.timelineBarItem, { backgroundColor: '#38BDF8', width: 44 }]} />
                <View style={[styles.timelineBarItem, { backgroundColor: isDark ? '#334155' : '#E2E8F0', width: 28 }]} />
              </View>
            </Animated.View>

            {/* Floating Mini Tag Badge */}
            <Animated.View
              style={[
                styles.floatingPill,
                {
                  backgroundColor: isDark ? '#3B0764' : '#FAF5FF',
                  borderColor: isDark ? '#9333EA' : '#E9D5FF',
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              <MaterialIcons name="bolt" size={13} color="#9333EA" />
              <Text style={[styles.pillText, { color: '#9333EA' }]}>Live Feed</Text>
            </Animated.View>
          </View>
        );

      case 'transactions':
      default:
        return (
          <View style={[styles.artBox, compact && styles.artBoxCompact]}>
            {/* Ambient Background Circles */}
            <Animated.View
              style={[
                styles.ambientCircle,
                {
                  backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.10)',
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View
              style={[
                styles.ambientCircleSecondary,
                { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)' },
              ]}
            />

            {/* Central Floating Card: Receipt with Split */}
            <Animated.View
              style={[
                styles.cardBase,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.25)' : '#E0F2FE' }]}>
                <MaterialIcons name="receipt-long" size={compact ? 24 : 32} color="#0284C7" />
              </View>

              <View style={styles.receiptLineRow}>
                <View style={[styles.receiptLine, { backgroundColor: isDark ? '#475569' : '#CBD5E1', width: 36 }]} />
                <View style={[styles.receiptDot, { backgroundColor: '#10B981' }]} />
                <View style={[styles.receiptLine, { backgroundColor: isDark ? '#334155' : '#E2E8F0', width: 22 }]} />
              </View>
            </Animated.View>

            {/* Floating Mini Tag Badge */}
            <Animated.View
              style={[
                styles.floatingPill,
                {
                  backgroundColor: isDark ? '#451A03' : '#FFFBEB',
                  borderColor: isDark ? '#D97706' : '#FDE68A',
                  transform: [{ translateY: floatAnim }],
                },
              ]}
            >
              <MaterialIcons name="account-balance-wallet" size={13} color="#D97706" />
              <Text style={[styles.pillText, { color: '#D97706' }]}>Split in 1 Tap</Text>
            </Animated.View>
          </View>
        );
    }
  };

  // Default strings per type
  const defaultTitles: Record<EmptyIllustrationType, string> = {
    groups: 'No Groups Yet',
    contacts: 'No Contacts Added',
    activity: 'No Activity Yet',
    transactions: 'No Expenses Recorded',
  };

  const defaultDescriptions: Record<EmptyIllustrationType, string> = {
    groups: 'Create or join a group with flatmates or friends to start sharing expenses seamlessly.',
    contacts: 'Add your friends or sync from contacts to split dinners, trips, and daily bills effortlessly.',
    activity: 'New group expenses, payments, and settlements will automatically appear in this live timeline.',
    transactions: 'No expenses have been added to this period yet. Tap the button below to record the first bill.',
  };

  const finalTitle = title !== undefined ? title : defaultTitles[type];
  const finalDesc = description !== undefined ? description : defaultDescriptions[type];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerLowest,
          borderColor: colors.outlineVariant,
        },
        compact && styles.containerCompact,
      ]}
    >
      {renderArt()}

      <Text style={[styles.title, { color: colors.onBackground }, compact && styles.titleCompact]}>
        {finalTitle}
      </Text>

      {finalDesc ? (
        <Text style={[styles.description, { color: colors.onSurfaceVariant }, compact && styles.descriptionCompact]}>
          {finalDesc}
        </Text>
      ) : null}

      {actionLabel && onActionPress ? (
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: colors.primary }]}
          onPress={onActionPress}
          activeOpacity={0.85}
        >
          <MaterialIcons name="add" size={18} color={colors.onPrimary} style={{ marginRight: 6 }} />
          <Text style={[styles.primaryActionText, { color: colors.onPrimary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {secondaryActionLabel && onSecondaryActionPress ? (
        <TouchableOpacity
          style={styles.secondaryActionBtn}
          onPress={onSecondaryActionPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryActionText, { color: colors.primary }]}>{secondaryActionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.xl + 4,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl + 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
    overflow: 'hidden',
  },
  containerCompact: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginVertical: Spacing.xs,
  },
  artBox: {
    width: 160,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  artBoxCompact: {
    width: 130,
    height: 96,
    marginBottom: Spacing.sm,
  },
  ambientCircle: {
    position: 'absolute',
    width: 105,
    height: 105,
    borderRadius: 55,
  },
  ambientCircleSecondary: {
    position: 'absolute',
    width: 75,
    height: 75,
    borderRadius: 40,
    top: 10,
    right: 18,
  },
  cardBase: {
    width: 96,
    height: 80,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    zIndex: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  groupAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  plusBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingPill: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 5,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  contactSyncMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  syncStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncStatusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  timelineBars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timelineBarItem: {
    height: 5,
    borderRadius: 3,
  },
  receiptLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  receiptLine: {
    height: 4,
    borderRadius: 2,
  },
  receiptDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  title: {
    ...Typography.titleMd,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  titleCompact: {
    ...Typography.titleSm,
    fontWeight: '700',
    marginBottom: 4,
  },
  description: {
    ...Typography.bodySm,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
    marginBottom: Spacing.md,
  },
  descriptionCompact: {
    fontSize: 12,
    lineHeight: 16,
    maxWidth: 260,
    marginBottom: Spacing.sm,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.full,
    elevation: 2,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  primaryActionText: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  secondaryActionText: {
    ...Typography.labelMd,
    fontWeight: '600',
  },
});
