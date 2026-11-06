import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

export const routingInstrumentation = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

/**
 * Initializes Sentry for Expo / React Native
 */
export const initSentry = () => {
  if (!SENTRY_DSN) {
    console.warn('[Sentry] EXPO_PUBLIC_SENTRY_DSN is not set. Sentry telemetry is running in fallback mode.');
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    debug: false,
    environment: __DEV__ ? 'development' : 'production',
    release: `splitmate@${Constants.expoConfig?.version || '1.0.0'}`,
    dist: Constants.expoConfig?.android?.versionCode?.toString() || '1',
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    attachStacktrace: true,
    integrations: [
      routingInstrumentation,
    ],
    enabled: !__DEV__ || !!SENTRY_DSN,
  });
};

/**
 * Set authenticated user context in Sentry
 */
export const setSentryUserContext = (user: { uid: string; email?: string | null; displayName?: string | null }) => {
  try {
    Sentry.setUser({
      id: user.uid,
      email: user.email || undefined,
      username: user.displayName || undefined,
    });
  } catch (e) {
    console.warn('[Sentry] Failed to set user context:', e);
  }
};

/**
 * Clear user context on sign out
 */
export const clearSentryUserContext = () => {
  try {
    Sentry.setUser(null);
  } catch (e) {
    console.warn('[Sentry] Failed to clear user context:', e);
  }
};

/**
 * Capture custom error or exception with additional tags/context
 */
export const captureError = (error: any, context?: Record<string, any>) => {
  try {
    if (context) {
      Sentry.withScope((scope) => {
        if (context.tags) {
          Object.entries(context.tags).forEach(([key, val]) => {
            scope.setTag(key, String(val));
          });
        }
        if (context.extra) {
          Object.entries(context.extra).forEach(([key, val]) => {
            scope.setExtra(key, val);
          });
        }
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  } catch (e) {
    console.error('[Sentry] Error capturing exception:', e);
  }
};

/**
 * Add a custom breadcrumb to Sentry trace
 */
export const addSentryBreadcrumb = (category: string, message: string, data?: Record<string, any>) => {
  try {
    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level: 'info',
    });
  } catch (e) {
    // Ignore breadcrumb errors
  }
};
