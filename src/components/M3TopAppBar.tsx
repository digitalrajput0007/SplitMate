import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3TopAppBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function M3TopAppBar({ title, subtitle, onBack, actions }: M3TopAppBarProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.topBar, { backgroundColor: colors.background }]}>
      {onBack ? (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.onBackground} strokeWidth="2.5" strokeLinecap="round">
            <Path d="M19 12H5M12 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 12 }} />
      )}

      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: colors.onBackground }]} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]} numberOfLines={1}>{subtitle}</Text>}
      </View>

      {actions ? <View style={styles.actions}>{actions}</View> : <View style={{ width: 48 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titleContainer: { flex: 1, alignItems: 'center' },
  title: { ...Typography.titleMd, fontWeight: '600' },
  subtitle: { ...Typography.labelMd, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
