import { User } from 'firebase/auth';
import {
  getUserProfileFromFirestore,
  isProfileComplete,
  UserProfile,
  getPersistentProfileStatus,
  getPersistentProfile,
} from './firestoreService';
import { ENABLE_OTP } from '../config/appConfig';

export { isProfileComplete, UserProfile };

export interface ResolveUserResult {
  status: 'complete' | 'needs_setup' | 'unverified' | 'error';
  profile: UserProfile | null;
  error?: any;
  message?: string;
}

// In-flight resolver promise cache to prevent concurrent executions for the same user
const activeResolutions = new Map<string, Promise<ResolveUserResult>>();

// Track last navigated route and timestamp to prevent duplicate navigations
let lastNavigatedRoute: string | null = null;
let lastNavigatedTimestamp = 0;

export interface ResolveOptions {
  navigation?: any;
  fromGoogle?: boolean;
  googleName?: string;
  googlePhoto?: string;
  preventNavigation?: boolean; // Set true when caller only wants status without triggering navigation
}

/**
 * Shared canonical post-authentication resolver for both Email/Password and Google Sign-In.
 * Resolves whether a user should go to Home/MainTabs, ProfileSetup, or EmailVerification,
 * and handles network errors explicitly without false routing.
 */
export async function resolveAuthenticatedUser(
  firebaseUser: User | null,
  options?: ResolveOptions
): Promise<ResolveUserResult> {
  if (!firebaseUser) {
    return {
      status: 'error',
      profile: null,
      message: 'No authenticated Firebase user found.',
    };
  }

  const uid = firebaseUser.uid;

  // Deduplicate concurrent resolver calls for the same UID
  if (activeResolutions.has(uid)) {
    console.log(`[Resolver] Re-using in-flight resolver for UID: ${uid}`);
    const inFlight = activeResolutions.get(uid)!;
    const result = await inFlight;
    applyNavigation(result, options, firebaseUser);
    return result;
  }

  const resolverPromise = (async (): Promise<ResolveUserResult> => {
    try {
      console.log(`[Resolver] Resolving authenticated user UID: ${uid}`);

      // 0. Instant Persistent Cache Check
      // If user profile is already known to be complete on this device, resolve immediately
      try {
        const persistentStatus = await getPersistentProfileStatus(uid);
        const persistentProfile = await getPersistentProfile(uid);
        if (persistentStatus === 'complete' && persistentProfile && isProfileComplete(persistentProfile)) {
          console.log(`[Resolver] Instant verified profile from persistent storage for UID: ${uid}`);
          return {
            status: 'complete',
            profile: persistentProfile,
          };
        }
      } catch (cacheErr) {
        // Fall back to network lookup
      }

      // 1. Check Email Verification
      // Google accounts are inherently email-verified by Google
      const isGoogleUser = firebaseUser.providerData.some((p: any) => p.providerId === 'google.com');
      const isEmailVerified = firebaseUser.emailVerified || isGoogleUser;

      // 2. Fetch Firestore Profile using canonical UID
      let profile: UserProfile | null = null;
      try {
        profile = await getUserProfileFromFirestore(uid, {
          throwOnError: true,
          bypassCache: true,
          forceServer: true,
        });
      } catch (fetchErr: any) {
        console.error('[Resolver] Firestore profile lookup error:', fetchErr);
        const isNetworkErr =
          fetchErr?.code === 'unavailable' ||
          fetchErr?.message?.includes('network') ||
          fetchErr?.message?.includes('offline') ||
          fetchErr?.message?.includes('timeout') ||
          fetchErr?.code === 'deadline-exceeded';

        if (isNetworkErr) {
          return {
            status: 'error',
            profile: null,
            error: fetchErr,
            message: 'Unable to connect to SplitMate servers. Please check your internet connection and try again.',
          };
        }

        // If permission error or other failure
        return {
          status: 'error',
          profile: null,
          error: fetchErr,
          message: fetchErr?.message || 'Failed to verify account profile.',
        };
      }

      // Check if profile has emailVerified in Firestore
      const isFirestoreVerified = !!(profile?.emailVerified || (profile as any)?.isVerified);
      const effectiveVerified = isEmailVerified || isFirestoreVerified;

      // Apply existing email verification rule:
      // If email is NOT verified, and it's a password account with ENABLE_OTP or verification required:
      if (!isGoogleUser && !effectiveVerified && ENABLE_OTP) {
        console.log('[Resolver] User email is not verified');
        return {
          status: 'unverified',
          profile,
          message: 'Please verify your email address to continue.',
        };
      }

      // 3. Determine if required profile fields are complete
      // Canonical check: Name + Mobile (or explicit profileCompleted: true)
      console.log('[Resolver] Profile fetched for UID:', uid, 'data:', JSON.stringify(profile));
      const complete = isProfileComplete(profile);
      console.log(`[Resolver] Profile completion status for ${uid}: ${complete}`);

      if (complete) {
        return {
          status: 'complete',
          profile,
        };
      } else {
        return {
          status: 'needs_setup',
          profile,
        };
      }
    } finally {
      // Clear from in-flight cache
      activeResolutions.delete(uid);
    }
  })();

  activeResolutions.set(uid, resolverPromise);

  const result = await resolverPromise;
  applyNavigation(result, options, firebaseUser);
  return result;
}

function applyNavigation(
  result: ResolveUserResult,
  options?: ResolveOptions,
  firebaseUser?: User
) {
  if (options?.preventNavigation) {
    return;
  }

  const nav = options?.navigation;
  if (!nav) {
    return;
  }

  const now = Date.now();

  if (result.status === 'complete') {
    // Avoid spamming duplicate navigation calls within 1.5 seconds
    if (lastNavigatedRoute === 'MainTabs' && now - lastNavigatedTimestamp < 1500) {
      return;
    }
    lastNavigatedRoute = 'MainTabs';
    lastNavigatedTimestamp = now;

    console.log('[Resolver] Navigating to MainTabs (profile complete)');
    try {
      if (typeof nav.reset === 'function') {
        nav.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } else {
        nav.navigate('MainTabs');
      }
    } catch (e) {
      nav.navigate('MainTabs');
    }
  } else if (result.status === 'needs_setup') {
    if (lastNavigatedRoute === 'ProfileSetup' && now - lastNavigatedTimestamp < 1500) {
      return;
    }
    lastNavigatedRoute = 'ProfileSetup';
    lastNavigatedTimestamp = now;

    console.log('[Resolver] Navigating to ProfileSetup (incomplete profile)');
    const displayName = options?.googleName || firebaseUser?.displayName || result.profile?.name;
    const photoURL = options?.googlePhoto || firebaseUser?.photoURL || result.profile?.photoUrl;

    try {
      nav.navigate('ProfileSetup', {
        displayName: displayName || undefined,
        photoURL: photoURL || undefined,
        fromGoogle: options?.fromGoogle,
      });
    } catch (e) {
      console.warn('[Resolver] Failed navigating to ProfileSetup:', e);
    }
  } else if (result.status === 'unverified') {
    if (lastNavigatedRoute === 'EmailVerificationOTP' && now - lastNavigatedTimestamp < 1500) {
      return;
    }
    lastNavigatedRoute = 'EmailVerificationOTP';
    lastNavigatedTimestamp = now;

    console.log('[Resolver] Navigating to EmailVerificationOTP');
    try {
      nav.navigate('EmailVerificationOTP', {
        email: firebaseUser?.email || '',
      });
    } catch (e) {
      console.warn('[Resolver] Failed navigating to EmailVerificationOTP:', e);
    }
  }
}
