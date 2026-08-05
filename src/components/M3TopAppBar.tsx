import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography } from '../constants/theme';

export interface M3TopAppBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export function M3TopAppBar({ title, subtitle, onBack, actions }: M3TopAppBarProps) {
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={Colors.onBackground} strokeWidth="2.5" strokeLinecap="round">
            <Path d="M19 12H5M12 19l-7-7 7-7" />
          </Svg>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 12 }} />
      )}

      <View style={styles.titleContainer}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
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
    backgroundColor: Colors.background,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  titleContainer: { flex: 1, alignItems: 'center' },
  title: { ...Typography.titleMd, color: Colors.onBackground, fontWeight: '600' },
  subtitle: { ...Typography.labelMd, color: Colors.onSurfaceVariant, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center' },
});
