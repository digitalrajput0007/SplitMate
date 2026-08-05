export const ADMOB_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
export const ADMOB_TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';

let hasShownInterstitialThisSession = false;

export const initializeInterstitialAd = () => {
  console.log('AdMob Interstitial initialized with Test Unit ID:', ADMOB_TEST_INTERSTITIAL_ID);
};

export const showSettleUpInterstitial = (onClosed?: () => void) => {
  if (hasShownInterstitialThisSession) {
    console.log('AdMob Interstitial already shown this session, skipping.');
    if (onClosed) onClosed();
    return;
  }

  hasShownInterstitialThisSession = true;
  console.log('AdMob Test Interstitial triggered after settle-up (Test ID: ca-app-pub-3940256099942544/1033173712).');
  if (onClosed) onClosed();
};

export const resetInterstitialSession = () => {
  hasShownInterstitialThisSession = false;
};
