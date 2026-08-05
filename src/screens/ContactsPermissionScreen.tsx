import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactsPermission'>;

export default function ContactsPermissionScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [requesting, setRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setRequesting(true);
    try {
      if (Contacts && typeof Contacts.requestPermissionsAsync === 'function') {
        await Contacts.requestPermissionsAsync();
      }
    } catch (err: any) {
      console.log('Contacts permission error:', err);
    } finally {
      setRequesting(false);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
          <Text style={styles.iconEmoji}>👥</Text>
        </View>

        <Text style={[styles.title, { color: colors.onSurface }]}>Find your friends</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
          Allow access to your contacts to quickly add friends and split bills in 1 tap.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <Text style={[styles.cardHeader, { color: colors.onSurface }]}>Why allow contacts access?</Text>
          <Text style={[styles.cardText, { color: colors.onSurfaceVariant }]}>
            • Easily add friends to new groups{'\n'}
            • See which contacts are already on SplitMate{'\n'}
            • Prefill UPI payment details for instant settlements
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleRequestPermission}
          activeOpacity={0.85}
          disabled={requesting}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
            {requesting ? 'Syncing...' : 'Allow Access'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.onSurfaceVariant }]}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.containerMargin,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  iconEmoji: {
    fontSize: 48,
  },
  title: {
    ...Typography.headlineLgMobile,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodyMd,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    maxWidth: 300,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    ...Shadows.card,
  },
  cardHeader: {
    ...Typography.titleMd,
    marginBottom: Spacing.xs,
  },
  cardText: {
    ...Typography.bodyMd,
    lineHeight: 22,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.button,
  },
  primaryButtonText: {
    ...Typography.titleMd,
  },
  secondaryButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  secondaryButtonText: {
    ...Typography.titleSm,
  },
});
