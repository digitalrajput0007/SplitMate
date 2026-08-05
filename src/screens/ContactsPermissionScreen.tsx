import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ContactsPermission'>;

export default function ContactsPermissionScreen({ navigation }: Props) {
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconEmoji}>👥</Text>
        </View>

        <Text style={styles.title}>Find your friends</Text>
        <Text style={styles.subtitle}>
          Allow access to your contacts to quickly add friends and split bills in 1 tap.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardHeader}>Why allow contacts access?</Text>
          <Text style={styles.cardText}>
            • Easily add friends to new groups{'\n'}
            • See which contacts are already on SplitMate{'\n'}
            • Prefill UPI payment details for instant settlements
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleRequestPermission}
          activeOpacity={0.85}
          disabled={requesting}
        >
          <Text style={styles.primaryButtonText}>
            {requesting ? 'Syncing...' : 'Allow Access'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] })}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>Skip for Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.primaryContainer,
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
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    maxWidth: 300,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Shadows.card,
  },
  cardHeader: {
    ...Typography.titleMd,
    color: Colors.onSurface,
    marginBottom: Spacing.xs,
  },
  cardText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    lineHeight: 22,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.primary,
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
    color: Colors.onPrimary,
  },
  secondaryButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  secondaryButtonText: {
    ...Typography.titleSm,
    color: Colors.onSurfaceVariant,
  },
});
