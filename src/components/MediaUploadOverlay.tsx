import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';

export interface MediaUploadOverlayProps {
  visible: boolean;
  progress: number; // 0-100
  title?: string;
}

export function MediaUploadOverlay({
  visible,
  progress,
  title = 'Uploading...'
}: MediaUploadOverlayProps) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.container}>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerHighest }]}>
          <ActivityIndicator color={colors.primary} size="large" />
          <View style={styles.textStack}>
            <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
            <Text style={[styles.progressText, { color: colors.onSurfaceVariant }]}>
              {Math.round(progress)}%
            </Text>
          </View>

          {/* Progress Bar Track */}
          <View style={[styles.track, { backgroundColor: colors.surfaceContainerLow }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: colors.primary,
                  width: `${progress}%`
                }
              ]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.md,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  textStack: {
    alignItems: 'center',
    gap: 2,
  },
  title: {
    ...Typography.titleMd,
    fontWeight: '700',
  },
  progressText: {
    ...Typography.labelMd,
    fontWeight: '600',
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
