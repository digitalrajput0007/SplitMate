import React from 'react';
import { View, ActivityIndicator, Text, Platform, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import AppNavigator from './src/navigation/AppNavigator';
import { NotificationService } from './src/services/NotificationService';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SecurityProvider } from './src/context/SecurityContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

// 5. Config expo-notifications at the root
try {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  console.log('Notifications setup skipped: module not found');
}

// 🔥 CRITICAL WEB FIX: Force browser to 100% height
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = `
    #root, body, html { height: 100%; margin: 0; padding: 0; display: flex; flex-direction: column; overflow: hidden; }
    div[data-testid="safe-area-provider"] { flex: 1; display: flex; flex-direction: column; }
  `;
  document.head.append(style);
}

import * as SplashScreen from 'expo-splash-screen';
import { InteractionManager } from 'react-native';

function MainAppContent() {
  const { colors, isDark } = useTheme();

  React.useEffect(() => {
    // Defer non-critical push notification permissions after UI mount
    InteractionManager.runAfterInteractions(() => {
      if (Platform.OS !== 'web') {
        try {
          NotificationService.requestUserPermission();
        } catch (e) {
          console.warn('Push notification permission failed:', e);
        }
      }
    });
  }, []);

  return (
    <ErrorBoundary>
      <SecurityProvider>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            {Platform.OS === 'web' ? (
              <View style={webStyles.outerContainer}>
                <View style={[webStyles.phoneFrame, { backgroundColor: colors.background }]}>
                  <AppNavigator />
                </View>
              </View>
            ) : (
              <AppNavigator />
            )}
          </View>
        </SafeAreaProvider>
      </SecurityProvider>
    </ErrorBoundary>
  );
}

function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...MaterialIcons.font,
    ...Ionicons.font,
  });

  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <MainAppContent />
    </ThemeProvider>
  );
}

import * as Sentry from '@sentry/react-native';

export default Sentry.wrap(App);

const webStyles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneFrame: {
    width: '100%',
    maxWidth: 480,
    height: '100%',
    maxHeight: 900,
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
  },
});
