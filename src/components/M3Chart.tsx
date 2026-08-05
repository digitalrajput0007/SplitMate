import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Typography, BorderRadius } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3ChartProps {
  data: { label: string; amount: number; color?: string }[];
  total?: number;
}

export function M3Chart({ data, total }: M3ChartProps) {
  const { colors } = useTheme();
  const sum = total || data.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <View style={styles.container}>
      {/* Progress Stack Bar */}
      <View style={[styles.barContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
        {data.map((item, index) => {
          const pct = sum > 0 ? (item.amount / sum) * 100 : 0;
          return (
            <View
              key={index}
              style={[
                styles.barSegment,
                {
                  width: `${pct}%`,
                  backgroundColor: item.color || colors.primaryContainer,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Legend Grid */}
      <View style={styles.legendGrid}>
        {data.map((item, index) => (
          <View key={index} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: item.color || colors.primaryContainer }]} />
            <Text style={[styles.legendLabel, { color: colors.onSurfaceVariant }]}>{item.label}</Text>
            <Text style={[styles.legendAmount, { color: colors.onSurface }]}>₹{item.amount}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  barContainer: {
    height: 12,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSegment: { height: '100%' },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '45%' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...Typography.labelMd, flex: 1 },
  legendAmount: { ...Typography.titleSm, fontWeight: '600' },
});
