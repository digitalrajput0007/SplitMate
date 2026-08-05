import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius } from '../constants/theme';

export interface M3ChartProps {
  data: { label: string; amount: number; color?: string }[];
  total?: number;
}

export function M3Chart({ data, total }: M3ChartProps) {
  const sum = total || data.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <View style={styles.container}>
      {/* Progress Stack Bar */}
      <View style={styles.barContainer}>
        {data.map((item, index) => {
          const pct = sum > 0 ? (item.amount / sum) * 100 : 0;
          return (
            <View
              key={index}
              style={[
                styles.barSegment,
                {
                  width: `${pct}%`,
                  backgroundColor: item.color || Colors.primaryContainer,
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
            <View style={[styles.dot, { backgroundColor: item.color || Colors.primaryContainer }]} />
            <Text style={styles.legendLabel}>{item.label}</Text>
            <Text style={styles.legendAmount}>₹{item.amount}</Text>
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
    backgroundColor: Colors.surfaceContainerHigh,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  barSegment: { height: '100%' },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: '45%' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...Typography.labelMd, color: Colors.onSurfaceVariant, flex: 1 },
  legendAmount: { ...Typography.titleSm, color: Colors.onSurface, fontWeight: '600' },
});
