import { Linking, Share } from 'react-native';
import Constants from 'expo-constants';
import packageJson from '../../package.json';

export const APP_VERSION: string =
  Constants.expoConfig?.version ||
  Constants.nativeAppVersion ||
  packageJson.version ||
  '1.2.1';

export const ENABLE_OTP = true;
export const ADS_ENABLED = true;
export const ENABLE_ADS = true;
export const ADMOB_BANNER_UNIT_ID = 'ca-app-pub-1680182248071758/2952937057';
export const ADMOB_INTERSTITIAL_UNIT_ID = 'ca-app-pub-1680182248071758/9072367701';
export const INTERSTITIAL_COOLDOWN_MS = __DEV__ ? 30 * 1000 : 2 * 60 * 1000; // 30s in dev, 2 min in prod

export const ANDROID_PACKAGE_NAME = 'com.splitmate.newapp';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.splitmate.newapp';
export const PLAY_STORE_MARKET_URI = 'market://details?id=com.splitmate.newapp';

/**
 * Uses React Native Share.share to share a friendly invite message containing PLAY_STORE_URL
 */
export async function shareApp(customMessage?: string): Promise<void> {
  const message = customMessage
    ? (customMessage.includes(PLAY_STORE_URL) ? customMessage : `${customMessage}\n\nDownload SplitMate: ${PLAY_STORE_URL}`)
    : `Hey! Track and split expenses with me on SplitMate. Download the app here:\n${PLAY_STORE_URL}`;

  try {
    await Share.share({
      message,
      title: 'SplitMate',
    });
  } catch (error) {
    console.warn('[ShareApp] Error sharing app:', error);
  }
}

/**
 * Tries Linking.openURL(PLAY_STORE_MARKET_URI) first so Android opens the native Google Play Store app directly,
 * and falls back to Linking.openURL(PLAY_STORE_URL) in a catch block.
 */
export async function openPlayStoreRating(): Promise<void> {
  try {
    await Linking.openURL(PLAY_STORE_MARKET_URI);
  } catch (error) {
    try {
      await Linking.openURL(PLAY_STORE_URL);
    } catch (fallbackError) {
      console.warn('[PlayStore] Error opening rating link:', fallbackError);
    }
  }
}
