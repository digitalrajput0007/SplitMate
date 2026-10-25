import mobileAds, {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ADS_ENABLED,
  ADMOB_INTERSTITIAL_UNIT_ID,
  INTERSTITIAL_COOLDOWN_MS,
} from '../config/appConfig';

const ASYNC_STORAGE_INTERSTITIAL_KEY = '@splitmate_last_interstitial_ts';

export const ADMOB_TEST_BANNER_ID = TestIds.ADAPTIVE_BANNER;
export const ADMOB_TEST_INTERSTITIAL_ID = TestIds.INTERSTITIAL;

// In __DEV__ mode, always use AdMob's official test ad unit IDs
const INTERSTITIAL_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : ADMOB_INTERSTITIAL_UNIT_ID;

let interstitialAd: InterstitialAd | null = null;
let isAdLoaded = false;
let isAdLoading = false;
let lastInterstitialShowTime = 0;
let isInitialized = false;

// Load persisted timestamp on startup
AsyncStorage.getItem(ASYNC_STORAGE_INTERSTITIAL_KEY)
  .then((val) => {
    if (val) {
      lastInterstitialShowTime = parseInt(val, 10) || 0;
    }
  })
  .catch(() => {});

/**
 * Preloads the next interstitial ad if not already loading or loaded
 */
const preloadInterstitial = () => {
  if (!ADS_ENABLED || isAdLoaded || isAdLoading) {
    return;
  }

  try {
    isAdLoading = true;
    interstitialAd = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      isAdLoaded = true;
      isAdLoading = false;
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      isAdLoaded = false;
      isAdLoading = false;
      // Preload next ad for future use
      preloadInterstitial();
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('[AdMob] Interstitial failed to load:', error);
      isAdLoaded = false;
      isAdLoading = false;
    });

    interstitialAd.load();
  } catch (err) {
    console.warn('[AdMob] Error creating interstitial:', err);
    isAdLoading = false;
  }
};

/**
 * Initializes the Mobile Ads SDK and preloads an interstitial
 */
export const initializeInterstitialAd = async (): Promise<void> => {
  if (!ADS_ENABLED) {
    return;
  }

  if (!isInitialized) {
    try {
      await mobileAds().initialize();
      isInitialized = true;
    } catch (e) {
      console.warn('[AdMob] Failed to initialize Google Mobile Ads SDK:', e);
    }
  }

  preloadInterstitial();
};

/**
 * Checks whether an interstitial can be shown according to strict frequency capping
 */
export const canShowInterstitial = (): boolean => {
  if (!ADS_ENABLED) return false;
  const elapsed = Date.now() - lastInterstitialShowTime;
  return elapsed >= INTERSTITIAL_COOLDOWN_MS;
};

/**
 * Shows an interstitial ad if ready.
 * Always calls onClosed (or falls back immediately) so user flow is never blocked.
 */
export const showInterstitialAd = async (onClosed?: () => void) => {
  if (!ADS_ENABLED) {
    if (onClosed) onClosed();
    return;
  }

  // Check cooldown
  const now = Date.now();
  if (now - lastInterstitialShowTime < INTERSTITIAL_COOLDOWN_MS) {
    const remainingSecs = Math.ceil((INTERSTITIAL_COOLDOWN_MS - (now - lastInterstitialShowTime)) / 1000);
    console.log(`[AdMob] Interstitial cooldown active (~${remainingSecs}s remaining), skipping.`);
    if (onClosed) onClosed();
    return;
  }

  if (interstitialAd && isAdLoaded) {
    try {
      let closedCallbackCalled = false;
      const safeClose = () => {
        if (!closedCallbackCalled) {
          closedCallbackCalled = true;
          if (onClosed) onClosed();
        }
      };

      const unsubscribeClosed = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        unsubscribeClosed();
        lastInterstitialShowTime = Date.now();
        AsyncStorage.setItem(ASYNC_STORAGE_INTERSTITIAL_KEY, String(lastInterstitialShowTime)).catch(() => {});
        safeClose();
      });

      const unsubscribeError = interstitialAd.addAdEventListener(AdEventType.ERROR, (err) => {
        unsubscribeError();
        console.warn('[AdMob] Error while showing interstitial:', err);
        safeClose();
      });

      await interstitialAd.show();
    } catch (error) {
      console.warn('[AdMob] Failed to show interstitial ad:', error);
      if (onClosed) onClosed();
    }
  } else {
    // If not ready, preload for next time and continue immediately
    preloadInterstitial();
    if (onClosed) onClosed();
  }
};

export const showSettleUpInterstitial = showInterstitialAd;

export const resetInterstitialSession = () => {
  lastInterstitialShowTime = 0;
  AsyncStorage.removeItem(ASYNC_STORAGE_INTERSTITIAL_KEY).catch(() => {});
};
