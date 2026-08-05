import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { useTheme, ThemeMode } from '../context/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'AppTheme'>;

export default function AppThemeScreen({ navigation }: Props) {
  const { themeMode, setThemeMode, colors, isDark } = useTheme();

  const handleSelectTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 20) + Spacing.xs;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <RNStatusBar backgroundColor={colors.background} barStyle={isDark ? "light-content" : "dark-content"} translucent />
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.onBackground }]}>App Theme</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.divider }]}>
          <Text style={[styles.sectionLabel, { color: colors.onSurface }]}>Theme Mode</Text>
          <Text style={[styles.sectionSub, { color: colors.onSurfaceVariant }]}>Choose your preferred appearance for SplitMate.</Text>

          {/* Visual Mode Previews */}
          <View style={styles.previewGrid}>
            {/* Light Mode Card */}
            <TouchableOpacity
              style={[
                styles.previewCard,
                styles.lightPreviewCard,
                themeMode === 'Light' && { borderColor: colors.primary },
              ]}
              onPress={() => handleSelectTheme('Light')}
              activeOpacity={0.8}
            >
              <View style={styles.previewMockupLight}>
                <View style={styles.mockHeaderLight} />
                <View style={styles.mockLineLight} />
                <View style={[styles.mockLineLight, { width: '60%' }]} />
                <View style={styles.mockBadgeLight} />
              </View>
              <Text style={styles.previewLabelLight}>Light Mode</Text>
              {themeMode === 'Light' && (
                <View style={styles.activeCheck}>
                  <MaterialIcons name="check-circle" size={20} color={Colors.primary} />
                </View>
              )}
            </TouchableOpacity>

            {/* Dark Mode Card */}
            <TouchableOpacity
              style={[
                styles.previewCard,
                styles.darkPreviewCard,
                themeMode === 'Dark' && { borderColor: colors.primary },
              ]}
              onPress={() => handleSelectTheme('Dark')}
              activeOpacity={0.8}
            >
              <View style={styles.previewMockupDark}>
                <View style={styles.mockHeaderDark} />
                <View style={styles.mockLineDark} />
                <View style={[styles.mockLineDark, { width: '60%' }]} />
                <View style={styles.mockBadgeDark} />
              </View>
              <Text style={styles.previewLabelDark}>Dark Mode</Text>
              {themeMode === 'Dark' && (
                <View style={styles.activeCheck}>
                  <MaterialIcons name="check-circle" size={20} color={colors.primary} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* List options */}
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
                  style={[
                    styles.optionRow,
                    { backgroundColor: isSelected ? colors.primaryFixed : colors.surfaceContainerLow }
                  ]}
                  onPress={() => handleSelectTheme(item.mode as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: colors.onSurface }]}>{item.label}</Text>
                    <Text style={[styles.optionSub, { color: colors.onSurfaceVariant }]}>{item.desc}</Text>
                  </View>
                  <MaterialIcons
                    name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                    size={22}
                    color={isSelected ? colors.primary : colors.outlineVariant}
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
  previewGrid: { flexDirection: 'row', gap: Spacing.md, marginVertical: Spacing.xs },
  previewCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  lightPreviewCard: { backgroundColor: '#F9F9F9' },
  darkPreviewCard: { backgroundColor: '#121212' },
  previewCardActive: { borderColor: Colors.primary },
  previewMockupLight: {
    width: '100%',
    height: 70,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    padding: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E2E2',
  },
  mockHeaderLight: { height: 10, width: '40%', backgroundColor: '#24389C', borderRadius: 4 },
  mockLineLight: { height: 6, width: '80%', backgroundColor: '#E8E8E8', borderRadius: 3 },
  mockBadgeLight: { height: 12, width: '30%', backgroundColor: '#DEE0FF', borderRadius: 4, marginTop: 'auto' },

  previewMockupDark: {
    width: '100%',
    height: 70,
    backgroundColor: '#1E1E1E',
    borderRadius: BorderRadius.md,
    padding: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  mockHeaderDark: { height: 10, width: '40%', backgroundColor: '#5C6BC0', borderRadius: 4 },
  mockLineDark: { height: 6, width: '80%', backgroundColor: '#333333', borderRadius: 3 },
  mockBadgeDark: { height: 12, width: '30%', backgroundColor: '#374151', borderRadius: 4, marginTop: 'auto' },

  previewLabelLight: { ...Typography.labelLg, color: '#1A1C1C', marginTop: 8, fontWeight: '600' },
  previewLabelDark: { ...Typography.labelLg, color: '#F3F4F6', marginTop: 8, fontWeight: '600' },
  activeCheck: { position: 'absolute', top: 6, right: 6 },

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
