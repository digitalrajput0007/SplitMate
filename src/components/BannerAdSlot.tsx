import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ADMOB_TEST_BANNER_ID } from '../services/adMobService';
import { BorderRadius, Typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export function BannerAdSlot() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.adBadgeRow}>
        <Text style={[styles.adBadge, { backgroundColor: colors.primary, color: colors.onPrimary }]}>AD</Text>
        <Text style={[styles.adTitle, { color: colors.onSurface }]}>Google AdMob Banner Slot</Text>
      </View>
      <Text style={[styles.adUnitText, { color: colors.onSurfaceVariant }]}>Test Unit ID: {ADMOB_TEST_BANNER_ID}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 12,
    borderRadius: BorderRadius.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  adBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  adTitle: {
    ...Typography.labelMd,
    fontWeight: '600',
  },
  adUnitText: {
    ...Typography.labelMd,
    fontSize: 11,
    marginTop: 2,
  },
});
