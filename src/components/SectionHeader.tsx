import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing } from '../theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionText?: string;
  onActionPress?: () => void;
  rightElement?: React.ReactNode;
}

export function SectionHeader({
  title,
  subtitle,
  actionText,
  onActionPress,
  rightElement,
}: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.titleColumn}>
        <Text style={[styles.title, { color: colors.onBackground }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{subtitle}</Text>
        ) : null}
      </View>

      {rightElement ? (
        rightElement
      ) : actionText && onActionPress ? (
        <TouchableOpacity onPress={onActionPress} activeOpacity={0.7} style={styles.actionBtn}>
          <Text style={[styles.actionText, { color: colors.primary }]}>{actionText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    ...Typography.titleMd,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    ...Typography.bodySm,
    marginTop: 2,
  },
  actionBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionText: {
    ...Typography.labelLg,
    fontWeight: '600',
  },
});
