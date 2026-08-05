import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors } from '../constants/theme';
import { ExpenseData } from '../services/firestoreService';

// Existing Screens
import SplashScreen from '../screens/SplashScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SignInScreen from '../screens/SignInScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import ContactsPermissionScreen from '../screens/ContactsPermissionScreen';
import HomeScreen from '../screens/HomeScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import SettleUpScreen from '../screens/SettleUpScreen';
import CreateGroupModal from '../screens/CreateGroupModal';

// Account Tab Suite
import AccountScreen from '../screens/AccountScreen';
import ProfileEditScreen from '../screens/ProfileEditScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import AppSettingsScreen from '../screens/AppSettingsScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';

// Activity & Notifications
import ActivityScreen from '../screens/ActivityScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

// Group & Expense Management
import GroupSettingsScreen from '../screens/GroupSettingsScreen';
import ExpenseDetailScreen from '../screens/ExpenseDetailScreen';
import RecurringExpensesScreen from '../screens/RecurringExpensesScreen';
import PrivacySecurityScreen from '../screens/PrivacySecurityScreen';
import ContactUsScreen from '../screens/ContactUsScreen';

import ContactsScreen from '../screens/ContactsScreen';
import InviteContactsScreen from '../screens/InviteContactsScreen';
import AppThemeScreen from '../screens/AppThemeScreen';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  EmailVerification: { email: string };
  ProfileSetup: { displayName?: string; photoURL?: string; fromGoogle?: boolean } | undefined;
  ContactsPermission: undefined;
  MainTabs: undefined;
  AddExpense: { groupId?: string; groupName?: string } | undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string; groupName: string };
  SettleUp: { groupId: string };
  ProfileEdit: undefined;
  PaymentMethods: undefined;
  NotificationSettings: undefined;
  AppSettings: undefined;
  AppTheme: undefined;
  HelpSupport: undefined;
  Notifications: undefined;
  GroupSettings: { groupId: string };
  ExpenseDetail: { expense: ExpenseData };
  RecurringExpenses: undefined;
  PrivacySecurity: undefined;
  ContactUs: undefined;
  InviteContacts: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  GroupsTab: undefined;
  ContactsTab: undefined;
  ActivityTab: undefined;
  AccountTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

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

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.outline,
        tabBarStyle: {
          backgroundColor: Colors.surfaceContainerLowest,
          borderTopColor: Colors.divider,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
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
      <Tab.Screen name="GroupsTab" component={HomeScreen} options={{ title: 'Groups' }} />
      <Tab.Screen name="ContactsTab" component={ContactsScreen} options={{ title: 'Contacts' }} />
      <Tab.Screen name="ActivityTab" component={ActivityScreen} options={{ title: 'Activity' }} />
      <Tab.Screen name="AccountTab" component={AccountScreen} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}

import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../config/firebase';
import { getUserProfileFromFirestore } from '../services/firestoreService';

export default function AppNavigator() {
  const [initializing, setInitializing] = React.useState(true);
  const [user, setUser] = React.useState<User | null>(null);
  const [initialRoute, setInitialRoute] = React.useState<keyof RootStackParamList>('Splash');

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        try {
          const prof = await getUserProfileFromFirestore(authUser.uid);
          if (prof && prof.name && prof.paymentHandle) {
            setInitialRoute('MainTabs');
          } else {
            setInitialRoute('ProfileSetup');
          }
        } catch (e) {
          setInitialRoute('MainTabs');
        }
      } else {
        setInitialRoute('Splash');
      }
      if (initializing) setInitializing(false);
    });

    return () => unsubscribe();
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="SignIn" component={SignInScreen} />
        <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="ContactsPermission" component={ContactsPermissionScreen} />
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="CreateGroup" component={CreateGroupModal} options={{ presentation: 'modal' }} />
        <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
        <Stack.Screen name="SettleUp" component={SettleUpScreen} options={{ presentation: 'modal' }} />
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
        <Stack.Screen name="InviteContacts" component={InviteContactsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
