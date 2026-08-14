import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ADMOB_TEST_BANNER_ID } from '../services/adMobService';
import { BorderRadius, Typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export function BannerAdSlot() {
  // Ads disabled as per user request
  return null;
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
