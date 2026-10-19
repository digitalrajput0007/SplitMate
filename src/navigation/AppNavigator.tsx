import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Path, Circle } from 'react-native-svg';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfileFromFirestore, isProfileComplete } from '../services/firestoreService';
import { resolveAuthenticatedUser } from '../services/authService';
import { useTheme } from '../context/ThemeContext';
import { useSecurity } from '../context/SecurityContext';
import { addSentryBreadcrumb, routingInstrumentation } from '../config/sentry';

// Screens
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SignInScreen from '../screens/SignInScreen';
import HomeScreen from '../screens/HomeScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import OTPScreen from '../screens/OTPScreen';
import EmailScreen from '../screens/EmailScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import EmailVerificationOTPScreen from '../screens/EmailVerificationOTPScreen';
import ResetPasswordOTPScreen from '../screens/ResetPasswordOTPScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import SettleUpScreen from '../screens/SettleUpScreen';
import CreateGroupModal from '../screens/CreateGroupModal';
import SettlementCenterScreen from '../screens/SettlementCenterScreen';
import AccountScreen from '../screens/AccountScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import AppSettingsScreen from '../screens/AppSettingsScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import ActivityScreen from '../screens/ActivityScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import GroupSettingsScreen from '../screens/GroupSettingsScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import RecurringExpensesScreen from '../screens/RecurringExpensesScreen';
import PrivacySecurityScreen from '../screens/PrivacySecurityScreen';
import ContactUsScreen from '../screens/ContactUsScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ContactSyncScreen from '../screens/ContactSyncScreen';
import AppThemeScreen from '../screens/AppThemeScreen';
import UnlockScreen from '../screens/UnlockScreen';
import SetupPinScreen from '../screens/SetupPinScreen';
import ContactsPermissionScreen from '../screens/ContactsPermissionScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import GroupsScreen from '../screens/GroupsScreen';
import { OfflineOverlay } from '../components/OfflineOverlay';
import { AppLoadingScreen } from '../components/AppLoadingScreen';

import { RootStackParamList, MainTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// --- Tab Icons ---
function HomeSvgIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Path d="M9 22V12h6v10" />
    </Svg>
  );
}

function GroupsSvgIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

function ContactsSvgIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Circle cx="9" cy="11" r="3" />
      <Path d="M15 9h3" />
      <Path d="M15 13h3" />
      <Path d="M6 17c0-2 2-3 3-3s3 1 3 3" />
    </Svg>
  );
}

function ActivitySvgIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Path d="M14 2v6h6" />
      <Path d="M16 13H8" />
      <Path d="M16 17H8" />
      <Path d="M10 9H8" />
    </Svg>
  );
}

function AccountSvgIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx="12" cy="7" r="4" />
    </Svg>
  );
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';

function MainTabNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Dynamically compute bottom padding and total tab bar height to clear Android navigation bar & iOS home indicator
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 16 : 10);
  const tabHeight = 60 + bottomInset;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false, // Ensure tabs don't show headers
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.outline,
        sceneContainerStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.surfaceContainerLowest,
          borderTopColor: colors.divider,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'HomeTab') return <HomeSvgIcon color={color} size={size} />;
          if (route.name === 'GroupsTab') return <GroupsSvgIcon color={color} size={size} />;
          if (route.name === 'ContactsTab') return <ContactsSvgIcon color={color} size={size} />;
          if (route.name === 'ActivityTab') return <ActivitySvgIcon color={color} size={size} />;
          if (route.name === 'AccountTab') return <AccountSvgIcon color={color} size={size} />;
          return <HomeSvgIcon color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="GroupsTab" component={GroupsScreen} options={{ title: 'Groups' }} />
      <Tab.Screen name="ContactsTab" component={ContactsScreen} options={{ title: 'Contacts' }} />
      <Tab.Screen name="ActivityTab" component={ActivityScreen} options={{ title: 'Activity' }} />
      <Tab.Screen name="AccountTab" component={AccountScreen} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}

import { subscribeToUserProfile } from '../services/firestoreService';
import { NotificationService } from '../services/NotificationService';

import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function AppNavigator({ onReady }: { onReady?: () => void }) {
  const { colors, isDark } = useTheme();
  const security = useSecurity();
  const [initializing, setInitializing] = React.useState(true);
  const [loadingProfile, setLoadingProfile] = React.useState(false);
  const [user, setUser] = React.useState<User | null>(null);
  const [userStatus, setUserStatus] = React.useState<{ isVerified: boolean; hasProfile: boolean } | null>(null);

  React.useEffect(() => {
    // Register global notification listeners for deep-linking
    const unsubNotif = NotificationService.setupListeners({
      navigate: (name: any, params?: any) => {
        if (navigationRef.isReady()) {
          navigationRef.navigate(name, params);
        } else {
          console.warn('[Navigation] Navigation ref not ready yet');
        }
      }
    });

    return () => {
      unsubNotif();
    };
  }, []);

  React.useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let isInitialized = false;

    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setLoadingProfile(true);
        const isGoogleUser = authUser.providerData.some(p => p.providerId === 'google.com');

        // Check user profile with shared canonical resolver logic
        let hasCompleteProfile = false;
        let isVerified = authUser.emailVerified || isGoogleUser || false;

        try {
          const resolveResult = await resolveAuthenticatedUser(authUser, { preventNavigation: true });
          if (resolveResult.status === 'complete') {
            hasCompleteProfile = true;
          } else if (resolveResult.status === 'unverified') {
            isVerified = false;
          }
        } catch (e) {
          console.warn('[AppNavigator] Error checking user profile:', e);
        }

        setUserStatus({
          isVerified,
          hasProfile: hasCompleteProfile,
        });
        setUser(authUser);
        setLoadingProfile(false);
        if (initializing) setInitializing(false);

        if (!isInitialized) {
          isInitialized = true;
          onReady?.();
        }

        // Trigger push token sync for authenticated user
        NotificationService.requestUserPermission();

        if (!unsubProfile) {
          unsubProfile = subscribeToUserProfile(authUser.uid, (profile) => {
            if (profile) {
              const complete = isProfileComplete(profile);
              setUserStatus((prev) => {
                const nextHasProfile = complete || (prev?.hasProfile ?? false);
                return {
                  isVerified: authUser.emailVerified || isGoogleUser || (profile as any)?.emailVerified || (profile as any)?.isVerified || false,
                  hasProfile: nextHasProfile,
                };
              });
            }
          });
        }
      } else {
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        setUserStatus(null);
        setUser(null);
        setLoadingProfile(false);
        if (initializing) setInitializing(false);

        if (!isInitialized) {
          isInitialized = true;
          onReady?.();
        }
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  if (initializing || loadingProfile || security.isLoading) {
    return (
      <>
        <AppLoadingScreen />
        <OfflineOverlay />
      </>
    );
  }

  const showLock = user && !security.isUnlocked;

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      primary: colors.primary
    },
  };

  const getInitialRouteName = () => {
    if (!user) return "SignIn";
    if (userStatus && !userStatus.hasProfile) return "ProfileSetup";
    return "MainTabs";
  };

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        ref={navigationRef}
        theme={navTheme}
        onReady={() => {
          routingInstrumentation.registerNavigationContainer(navigationRef);
        }}
        onStateChange={(state) => {
          try {
            const route = navigationRef.current?.getCurrentRoute();
            if (route) {
              addSentryBreadcrumb('navigation', `Navigated to ${route.name}`, { screen: route.name, params: route.params });
            }
          } catch (e) {
            // Ignore navigation tracking errors
          }
        }}
      >
        <Stack.Navigator
          initialRouteName={getInitialRouteName()}
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          {!user ? (
            <>
              <Stack.Screen name="SignIn" component={SignInScreen} />
              <Stack.Screen name="Splash" component={SplashScreen} />
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
              <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
              <Stack.Screen name="OTPScreen" component={OTPScreen} />
              <Stack.Screen name="OTPVerification" component={OTPScreen as any} />
              <Stack.Screen name="EmailVerificationOTP" component={EmailVerificationOTPScreen} />
              <Stack.Screen name="ResetPasswordOTP" component={ResetPasswordOTPScreen} />
              <Stack.Screen name="EmailScreen" component={EmailScreen} />
              <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            </>
          ) : !userStatus?.hasProfile ? (
            <>
              <Stack.Screen name="SignIn" component={SignInScreen} />
              <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
            </>
          ) : (
            <>
              {/* Authenticated Flow */}
              <Stack.Screen name="MainTabs" component={MainTabNavigator} />
              <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
              <Stack.Screen name="ContactsPermission" component={ContactsPermissionScreen} />
              <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="CreateGroup" component={CreateGroupModal} options={{ presentation: 'modal' }} />
              <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
              <Stack.Screen name="SettleUp" component={SettleUpScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="SettlementCenter" component={SettlementCenterScreen} />
              <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
              <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
              <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
              <Stack.Screen name="AppSettings" component={AppSettingsScreen} />
              <Stack.Screen name="AppTheme" component={AppThemeScreen as any} />
              <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} />
              <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
              <Stack.Screen name="RecurringExpenses" component={RecurringExpensesScreen} />
              <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
              <Stack.Screen name="ContactUs" component={ContactUsScreen} />
              <Stack.Screen name="ContactSync" component={ContactSyncScreen} />
              <Stack.Screen name="SetupPin" component={SetupPinScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {showLock && (
        <View style={StyleSheet.absoluteFill}>
          <UnlockScreen />
        </View>
      )}
      
      <OfflineOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
