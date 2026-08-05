import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Typography, BorderRadius, Shadows } from '../constants/theme';
import { INR_CURRENCY_CONFIG, CurrencyConfig } from '../services/currencyService';

const SUPPORTED_CURRENCIES: CurrencyConfig[] = [INR_CURRENCY_CONFIG];
import { useTheme } from '../context/ThemeContext';

export interface M3CurrencyPickerProps {
  selectedCurrency: CurrencyConfig;
  onSelectCurrency: (currency: CurrencyConfig) => void;
}

export function M3CurrencyPicker({ selectedCurrency, onSelectCurrency }: M3CurrencyPickerProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.trigger,
          {
            backgroundColor: colors.surfaceContainerLowest,
            borderColor: colors.outlineVariant,
          },
        ]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.triggerText, { color: colors.onSurface }]}>
          {selectedCurrency.symbol} ({selectedCurrency.code})
        </Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.onSurfaceVariant} strokeWidth="2">
          <Path d="M6 9l6 6 6-6" />
        </Svg>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={[styles.card, { backgroundColor: colors.surfaceContainerLowest }]}>
            <Text style={[styles.title, { color: colors.onSurface }]}>Select Currency</Text>
            {SUPPORTED_CURRENCIES.map((c: CurrencyConfig) => {
              const isActive = c.code === selectedCurrency.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.row,
                    isActive && { backgroundColor: colors.primaryFixed },
                  ]}
                  onPress={() => {
                    onSelectCurrency(c);
                    setVisible(false);
                  }}
                >
                  <Text style={[styles.symbol, { color: colors.primary }]}>{c.symbol}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.code, { color: colors.onSurface }]}>{c.code}</Text>
                    <Text style={[styles.name, { color: colors.onSurfaceVariant }]}>{c.name}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    height: 48,
  },
  triggerText: { ...Typography.bodyLg, fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    padding: 20,
    gap: 8,
    ...Shadows.dialog,
  },
  title: { ...Typography.titleMd, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: BorderRadius.md,
    gap: 12,
  },
  symbol: { fontSize: 20, fontWeight: '600', width: 28 },
  code: { ...Typography.titleSm, fontWeight: '600' },
  name: { ...Typography.labelMd },
});
