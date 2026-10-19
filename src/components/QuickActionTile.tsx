import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing, BorderRadius, Shadows } from '../theme';

interface QuickActionTileProps {
  label: string;
  iconName: keyof typeof MaterialIcons.glyphMap | keyof typeof Ionicons.glyphMap;
  iconType?: 'material' | 'ionicons';
  onPress: () => void;
  accentColor?: string;
  badgeCount?: number;
}

export function QuickActionTile({
  label,
  iconName,
  iconType = 'material',
  onPress,
  accentColor,
  badgeCount,
}: QuickActionTileProps) {
  const { colors, isDark } = useTheme();
  const themeAccent = accentColor || colors.primary;

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
      activeOpacity={0.75}
    >
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: isDark
              ? 'rgba(56, 189, 248, 0.15)'
              : '#F0F9FF',
          },
        ]}
      >
        {iconType === 'ionicons' ? (
          <Ionicons name={iconName as any} size={22} color={themeAccent} />
        ) : (
          <MaterialIcons name={iconName as any} size={22} color={themeAccent} />
        )}

        {badgeCount && badgeCount > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
          </View>
        ) : null}
      </View>

      <Text
        style={[styles.label, { color: colors.onSurface }]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 88,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...Shadows.card,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  label: {
    ...Typography.bodySm,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
