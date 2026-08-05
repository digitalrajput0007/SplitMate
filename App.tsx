import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import AppNavigator from './src/navigation/AppNavigator';
import { Colors } from './src/theme';

import { Platform, StyleSheet } from 'react-native';

import { ThemeProvider } from './src/context/ThemeContext';

import { useTheme } from './src/context/ThemeContext';

function MainAppContent() {
  const { colors, isDark } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <SafeAreaProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={webStyles.outerContainer}>
          <View style={[webStyles.phoneFrame, { backgroundColor: colors.background }]}>
            <AppNavigator />
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <MainAppContent />
    </ThemeProvider>
  );
}

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
    backgroundColor: Colors.background,
    borderRadius: Platform.OS === 'web' ? 24 : 0,
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
  },
});
