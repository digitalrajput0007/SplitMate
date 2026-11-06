import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing, BorderRadius } from '../theme';

interface EmptyStateProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
  style?: any;
}

export function EmptyState({
  icon = 'receipt-long',
  title,
  description,
  actionLabel,
  onActionPress,
  secondaryActionLabel,
  onSecondaryActionPress,
  style,
}: EmptyStateProps) {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }, style]}>
      <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#E0F2FE' }]}>
        <MaterialIcons name={icon} size={36} color={colors.primary} />
      </View>

      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.onSurfaceVariant }]}>{description}</Text>

      {actionLabel && onActionPress ? (
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={onActionPress}
          activeOpacity={0.8}
        >
          <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}

      {secondaryActionLabel && onSecondaryActionPress ? (
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onSecondaryActionPress}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>{secondaryActionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.titleMd,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  description: {
    ...Typography.bodyMd,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
    maxWidth: 280,
  },
  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.DEFAULT,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...Typography.labelLg,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: Spacing.xs,
  },
  secondaryBtnText: {
    ...Typography.labelLg,
    fontWeight: '500',
  },
});
