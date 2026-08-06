import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Typography, BorderRadius, Spacing, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';

export interface MediaUploadOverlayProps {
  visible: boolean;
  progress: number; // 0-100
  title?: string;
}

/**
 * Non-blocking Background Upload Pill (Phase 2)
 * Allows users to continue working while media uploads in background.
 */
export function MediaUploadOverlay({
  visible,
  progress,
  title = 'Uploading media...'
}: MediaUploadOverlayProps) {
  const { colors } = useTheme();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible && progress === 0) return null;

  return (
    <Animated.View
      style={[
        styles.floatingPill,
        {
          backgroundColor: colors.primary,
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }]
        }
      ]}
    >
      <ActivityIndicator color="#FFFFFF" size="small" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.pillTitle, { color: '#FFFFFF' }]}>{title}</Text>
        <View style={[styles.miniTrack, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
          <View style={[styles.miniFill, { width: `${progress}%`, backgroundColor: '#FFFFFF' }]} />
        </View>
      </View>
      <Text style={[styles.progressText, { color: '#FFFFFF' }]}>{Math.round(progress)}%</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingPill: {
    position: 'absolute',
    bottom: 90, // Above tab bar
    left: 20,
    right: 20,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
    zIndex: 999,
    ...Shadows.dialog,
  },
  pillTitle: {
    ...Typography.labelMd,
    fontWeight: '700',
  },
  miniTrack: {
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  miniFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    ...Typography.labelMd,
    fontWeight: '900',
    minWidth: 35,
    textAlign: 'right',
  },
});
