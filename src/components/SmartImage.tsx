import React from 'react';
import { StyleSheet, View, Text, Image as RNImage, ImageProps as RNImageProps } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../theme';

// Fallback to standard Image if expo-image fails to resolve or load
let ExpoImage: any = null;
try {
  // We use require to avoid compile-time resolution errors if the module is missing
  ExpoImage = require('expo-image').Image;
} catch (e) {
  console.warn('SmartImage: expo-image not found, falling back to react-native Image');
}

export interface SmartImageProps extends Omit<RNImageProps, 'source'> {
  uri?: string;
  thumbnailUri?: string;
  name?: string; // Optional name to generate initials
  mode?: 'thumbnail' | 'full';
  fallbackIcon?: keyof typeof MaterialIcons.glyphMap;
  size?: number;
}

/**
 * High-performance Image component with disk caching and thumbnail support
 * Includes a safety fallback to standard react-native Image
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

  const source = mode === 'thumbnail' ? (thumbnailUri || uri) : uri;
  const placeholder = mode === 'full' ? thumbnailUri : undefined;

  if (!source) {
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

  // Use ExpoImage if available
  if (ExpoImage) {
    return (
      <ExpoImage
        source={source}
        placeholder={placeholder}
        contentFit="cover"
        transition={200}
        cachePolicy="disk"
        style={[style, size ? { width: size, height: size, borderRadius: size / 2 } : {}]}
        {...props}
      />
    );
  }

  // Final fallback to React Native Image
  return (
    <RNImage
      source={{ uri: source }}
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
