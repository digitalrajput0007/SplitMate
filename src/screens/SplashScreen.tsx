import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';

import AppLogo from '../components/AppLogo';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Brand Icon & Name */}
      <View style={styles.centerContent}>
        <View style={styles.logoBox}>
          <AppLogo size={56} />
        </View>
        <Text style={styles.title}>SplitMate</Text>
        <Text style={styles.subtitle}>Split bills effortlessly with friends & roommates</Text>
      </View>

      {/* CTA Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Onboarding')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.button,
  },
  logoIcon: {
    fontSize: 44,
    color: Colors.onPrimaryContainer,
  },
  title: {
    ...Typography.headlineLg,
    color: Colors.onPrimary,
    fontSize: 36,
  },
  subtitle: {
    ...Typography.bodyLg,
    color: Colors.primaryFixedDim,
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
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.cardElevated,
  },
  buttonText: {
    ...Typography.titleMd,
    color: Colors.primary,
    fontWeight: '600',
  },
});
