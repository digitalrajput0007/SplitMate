import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors, Typography, BorderRadius, Shadows } from '../constants/theme';
import { CURRENCIES, CurrencyConfig } from '../services/currencyService';

export interface M3CurrencyPickerProps {
  selectedCurrency: CurrencyConfig;
  onSelectCurrency: (currency: CurrencyConfig) => void;
}

export function M3CurrencyPicker({ selectedCurrency, onSelectCurrency }: M3CurrencyPickerProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)} activeOpacity={0.8}>
        <Text style={styles.triggerText}>
          {selectedCurrency.symbol} ({selectedCurrency.code})
        </Text>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.onSurfaceVariant} strokeWidth="2">
          <Path d="M6 9l6 6 6-6" />
        </Svg>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.card}>
            <Text style={styles.title}>Select Currency</Text>
            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.row, c.code === selectedCurrency.code && styles.activeRow]}
                onPress={() => {
                  onSelectCurrency(c);
                  setVisible(false);
                }}
              >
                <Text style={styles.symbol}>{c.symbol}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.code}>{c.code}</Text>
                  <Text style={styles.name}>{c.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
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
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    height: 48,
  },
  triggerText: { ...Typography.bodyLg, color: Colors.onSurface, fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: BorderRadius.xl,
    padding: 20,
    gap: 8,
    ...Shadows.dialog,
  },
  title: { ...Typography.titleMd, color: Colors.onSurface, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: BorderRadius.md,
    gap: 12,
  },
  activeRow: { backgroundColor: Colors.primaryFixed },
  symbol: { fontSize: 20, fontWeight: '600', color: Colors.primary, width: 28 },
  code: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
  name: { ...Typography.labelMd, color: Colors.onSurfaceVariant },
});
