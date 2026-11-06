import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Typography, BorderRadius, Spacing, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';

export interface MediaUploadOverlayProps {
  visible: boolean;
  progress: number; // 0-100
  title?: string;
  bottomOffset?: number;
}

/**
 * Non-blocking Background Upload Pill
 * Displays clean progress bar and percentage when uploading media.
 */
export function MediaUploadOverlay({
  visible,
  progress,
  title = 'Uploading media...',
  bottomOffset = 30
}: MediaUploadOverlayProps) {
  const { colors } = useTheme();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible && progress === 0) return null;

  const clampedProgress = Math.min(100, Math.max(0, Math.round(progress || 0)));

  return (
    <Animated.View
      style={[
        styles.floatingPill,
        {
          backgroundColor: colors.primary,
          bottom: bottomOffset,
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }
      ]}
    >
      <ActivityIndicator color="#FFFFFF" size="small" />
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.pillTitle, { color: '#FFFFFF' }]}>{title}</Text>
          <Text style={[styles.progressText, { color: '#FFFFFF' }]}>{clampedProgress}%</Text>
        </View>
        <View style={[styles.miniTrack, { backgroundColor: 'rgba(255, 255, 255, 0.35)' }]}>
          <View style={[styles.miniFill, { width: `${clampedProgress}%`, backgroundColor: '#FFFFFF' }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingPill: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 62,
    borderRadius: 31,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 14,
    zIndex: 999,
    ...Shadows.dialog,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  pillTitle: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  miniTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  miniFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    ...Typography.labelMd,
    fontWeight: '900',
  },
});
