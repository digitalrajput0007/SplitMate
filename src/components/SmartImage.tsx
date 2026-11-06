import React, { useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Typography } from '../theme';

export interface SmartImageProps extends Omit<ExpoImageProps, 'source'> {
  uri?: string;
  thumbnailUri?: string;
  name?: string; // Optional name to generate initials
  mode?: 'thumbnail' | 'full';
  fallbackIcon?: keyof typeof MaterialIcons.glyphMap;
  size?: number;
}

/**
 * High-performance Image component powered by expo-image.
 * Features: Memory/disk caching, placeholder skeleton, smooth transitions, and initials fallback.
 */
export const SmartImage = React.memo(function SmartImage({
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
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // 1. Determine if we have any source at all
  const hasSource = !hasError && !!(uri || thumbnailUri);

  if (!hasSource) {
    const initials = name
      ? name.trim().split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
      : null;

    const isCustomIcon = fallbackIcon && fallbackIcon !== 'person';

    return (
      <View style={[styles.fallback, { backgroundColor: colors.primaryFixed }, style as any, size ? { width: size, height: size, borderRadius: size / 2 } : {}]}>
        {isCustomIcon ? (
          <MaterialIcons name={fallbackIcon} size={size ? size * 0.5 : 24} color={colors.primary} />
        ) : initials ? (
          <Text
            style={[
              styles.initials,
              {
                fontSize: size ? size * 0.38 : 16,
                color: colors.primary,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {initials}
          </Text>
        ) : (
          <MaterialIcons name={fallbackIcon} size={size ? size * 0.5 : 24} color={colors.primary} />
        )}
      </View>
    );
  }

  // 2. Dual-Layer Strategy: Prefer thumbnail for lists, full image for detail screens
  const sourceUri = mode === 'thumbnail' ? (thumbnailUri || uri) : (uri || thumbnailUri);
  const isSmallAvatar = !!(size && size <= 64);

  return (
    <View style={[{ position: 'relative', overflow: 'hidden' }, style as any, size ? { width: size, height: size, borderRadius: size / 2 } : {}]}>
      <ExpoImage
        source={{ uri: sourceUri }}
        style={[StyleSheet.absoluteFillObject]}
        contentFit="cover"
        transition={isSmallAvatar ? 0 : 150}
        cachePolicy="memory-disk"
        onLoadStart={() => {
          if (!isSmallAvatar) setIsLoading(true);
        }}
        onLoadEnd={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        {...props}
      />
      {isLoading && !isSmallAvatar && (
        <View style={[StyleSheet.absoluteFillObject, styles.placeholder, { backgroundColor: colors.surfaceContainerHigh }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'center',
    textAlign: 'center',
  },
});
