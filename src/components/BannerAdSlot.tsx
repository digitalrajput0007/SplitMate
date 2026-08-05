import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ADMOB_TEST_BANNER_ID } from '../services/adMobService';
import { Colors, BorderRadius, Typography } from '../constants/theme';

export function BannerAdSlot() {
  return (
    <View style={styles.container}>
      <View style={styles.adBadgeRow}>
        <Text style={styles.adBadge}>AD</Text>
        <Text style={styles.adTitle}>Google AdMob Banner Slot</Text>
      </View>
      <Text style={styles.adUnitText}>Test Unit ID: {ADMOB_TEST_BANNER_ID}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 12,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  adBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adBadge: {
    backgroundColor: Colors.primary,
    color: Colors.onPrimary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  adTitle: {
    ...Typography.labelMd,
    color: Colors.onSurface,
    fontWeight: '600',
  },
  adUnitText: {
    ...Typography.labelMd,
    color: Colors.onSurfaceVariant,
    fontSize: 11,
    marginTop: 2,
  },
});
