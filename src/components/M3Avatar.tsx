import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3AvatarProps {
  name?: string;
  uri?: string;
  size?: number;
  badgeCount?: number;
}

export function M3Avatar({ name = 'User', uri, size = 40, badgeCount }: M3AvatarProps) {
  const { colors } = useTheme();
  const initial = name.charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primaryFixed,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { borderRadius: size / 2 }]} />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.4, color: colors.primary }]}>{initial}</Text>
      )}

      {badgeCount !== undefined && badgeCount > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.surfaceContainerLowest }]}>
          <Text style={[styles.badgeText, { color: colors.onError }]}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  text: { ...Typography.titleSm, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  badgeText: { fontSize: 10, fontWeight: '700' },
});
