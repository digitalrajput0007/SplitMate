import { ExpenseData } from '../services/firestoreService';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  SignIn: undefined;
  MainTabs: { screen?: keyof MainTabParamList } | undefined;
  EmailScreen: undefined;
  OTPScreen: { email: string };
  ResetPasswordScreen: { email: string };
  EmailVerification: { email: string };
  EmailVerificationOTP: { email: string; password?: string };
  ResetPasswordOTP: { email: string };
  ProfileSetup: { displayName?: string, photoURL?: string, fromGoogle?: boolean } | undefined;
  OTPVerification: { email: string, type: 'verify' | 'reset' };
  ForgotPassword: { email?: string };
  AddExpense: { groupId?: string; groupName?: string; initialBillingMonth?: string } | undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string; groupName: string };
  SettleUp: { groupId: string; billingMonth?: string };
  SettlementCenter: undefined;
  ProfileEdit: undefined;
  PaymentMethods: undefined;
  NotificationSettings: undefined;
  AppSettings: undefined;
  AppTheme: undefined;
  HelpSupport: undefined;
  Notifications: undefined;
  GroupSettings: { groupId: string };
  ExpenseDetail: { expense?: ExpenseData; expenseId?: string };
  RecurringExpenses: undefined;
  PrivacySecurity: undefined;
  ContactUs: undefined;
  ContactSync: undefined;
  SetupPin: undefined;
  ContactsPermission: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  GroupsTab: undefined;
  ContactsTab: undefined;
  ActivityTab: undefined;
  AccountTab: undefined;
};
