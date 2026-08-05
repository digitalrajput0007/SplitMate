import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';

import { useTheme, ThemeMode } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AppSettings'>;

export default function AppThemeScreen({ navigation }: Props) {
  const { themeMode, setThemeMode } = useTheme();

  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    Alert.alert('Theme Updated', `${mode} mode has been applied to SplitMate.`);
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <SafeAreaView style={styles.container}>
      <RNStatusBar backgroundColor={Colors.background} barStyle="dark-content" translucent />
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onBackground} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>App Theme</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Theme Mode</Text>
          <Text style={styles.sectionSub}>Choose your preferred appearance for SplitMate.</Text>

          <View style={styles.optionsList}>
            {[
              { mode: 'System', label: 'System Default', desc: 'Match your phone settings' },
              { mode: 'Light', label: 'Light Mode', desc: 'Bright & clean interface' },
              { mode: 'Dark', label: 'Dark Mode', desc: 'Sleek dark theme' },
            ].map((item) => {
              const isSelected = themeMode === item.mode;
              return (
                <TouchableOpacity
                  key={item.mode}
                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                  onPress={() => handleSelectTheme(item.mode as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{item.label}</Text>
                    <Text style={styles.optionSub}>{item.desc}</Text>
                  </View>
                  <MaterialIcons
                    name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={22}
                    color={isSelected ? Colors.primary : Colors.outlineVariant}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMargin,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topBarTitle: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600' },
  scroll: { paddingHorizontal: Spacing.containerMargin, paddingBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Shadows.card,
    borderWidth: 1,
    borderColor: Colors.divider,
    gap: Spacing.md,
  },
  sectionLabel: { ...Typography.titleMd, color: Colors.onSurface, fontWeight: '700' },
  sectionSub: { ...Typography.bodySm, color: Colors.onSurfaceVariant, marginTop: -4 },
  optionsList: { gap: Spacing.xs },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerLow,
  },
  optionRowSelected: { backgroundColor: Colors.primaryFixed },
  optionTitle: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
  optionSub: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
});
