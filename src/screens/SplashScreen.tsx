import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import AppLogo from '../components/AppLogo';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Brand Icon & Name */}
      <View style={styles.centerContent}>
        <View style={[styles.logoBox, { backgroundColor: colors.primaryContainer }]}>
          <AppLogo size={56} />
        </View>
        <Text style={[styles.title, { color: colors.onBackground }]}>SplitMate</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>Split bills effortlessly with friends & roommates</Text>
      </View>

      {/* CTA Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Onboarding')}
          activeOpacity={0.85}
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingVertical: Spacing.xxl,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.button,
  },
  title: {
    ...Typography.headlineLg,
    fontSize: 36,
  },
  subtitle: {
    ...Typography.bodyLg,
    textAlign: 'center',
    marginTop: Spacing.sm,
    maxWidth: 320,
  },
  bottomBar: {
    width: '100%',
    paddingBottom: Spacing.md,
  },
  button: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.cardElevated,
  },
  buttonText: {
    ...Typography.titleMd,
    fontWeight: '600',
  },
});
