import React from 'react';
import { StyleSheet, View, Text, Image as RNImage, ImageProps as RNImageProps } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../theme';

export interface SmartImageProps extends Omit<RNImageProps, 'source'> {
  uri?: string;
  thumbnailUri?: string;
  name?: string; // Optional name to generate initials
  mode?: 'thumbnail' | 'full';
  fallbackIcon?: keyof typeof MaterialIcons.glyphMap;
  size?: number;
}

/**
 * High-performance Image component (Standard Version)
 * Reverted to React Native Image to prevent native module crashes (ExpoImage).
 * Features: Dual-layer strategy and initials fallback.
 */
export function SmartImage({
  uri,
  thumbnailUri,
  name,
  mode = 'full',
  fallbackIcon = 'person',
  size,
  style,
  ...props
}: SmartImageProps) {
  const { colors } = useTheme();

  // 1. Determine if we have any source at all
  const hasSource = !!(uri || thumbnailUri);

  if (!hasSource) {
    const initials = name
      ? name.trim().split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : null;

    return (
      <View style={[styles.fallback, { backgroundColor: colors.primaryFixed }, style, size ? { width: size, height: size, borderRadius: size / 2 } : {}]}>
        {initials ? (
          <Text style={[styles.initials, { fontSize: size ? size * 0.4 : 16, color: colors.primary }]}>{initials}</Text>
        ) : (
          <MaterialIcons name={fallbackIcon} size={size ? size * 0.5 : 24} color={colors.primary} />
        )}
      </View>
    );
  }

  // 2. Dual-Layer Strategy
  // For lists, we prefer the thumbnail. For full view, we use original.
  const sourceUri = mode === 'thumbnail' ? (thumbnailUri || uri) : (uri || thumbnailUri);

  // 3. Render with standard React Native Image
  return (
    <RNImage
      source={{ uri: sourceUri || '' }}
      style={[style, size ? { width: size, height: size, borderRadius: size / 2 } : {}]}
      resizeMode="cover"
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
});
