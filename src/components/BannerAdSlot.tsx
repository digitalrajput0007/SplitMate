import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import {
  ADS_ENABLED,
  ADMOB_BANNER_UNIT_ID,
} from '../config/appConfig';
import { BorderRadius } from '../constants/theme';

const BANNER_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : ADMOB_BANNER_UNIT_ID;

interface BannerAdSlotProps {
  size?: BannerAdSize;
  style?: any;
}

export function BannerAdSlot({ size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER, style }: BannerAdSlotProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // If ads are disabled or on unsupported platform (web), do not render
  if (!ADS_ENABLED || Platform.OS === 'web' || hasError) {
    return null;
  }

  return (
    <View style={[styles.container, style, !isLoaded && styles.hidden]}>
      <BannerAd
        unitId={BANNER_UNIT_ID}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
        onAdLoaded={() => {
          setIsLoaded(true);
          setHasError(false);
        }}
        onAdFailedToLoad={(error) => {
          console.warn('[AdMob] Banner ad failed to load:', error);
          setHasError(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    borderRadius: BorderRadius.DEFAULT,
    overflow: 'hidden',
  },
  hidden: {
    display: 'none',
  },
});
