import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { formatCurrency } from '../../services/firestoreService';
import { Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import { LightColors } from '../../theme';
import { SmartImage } from '../SmartImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface DonutDataItem {
  id: string;
  label: string;
  sublabel?: string;
  value: number;
  color: string;
  icon?: string;
  initials?: string;
  photoUrl?: string;
  photoThumbnailUrl?: string;
  isCurrentUser?: boolean;
  secondaryAmount?: number;
  secondaryLabel?: string;
}

interface InteractiveDonutChartProps {
  data: DonutDataItem[];
  totalValue: number;
  centerTitle?: string;
  centerSubtitle?: string;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  colors: typeof LightColors;
  isDark: boolean;
  size?: number;
  showLegend?: boolean;
  emptyLabel?: string;
}

export const InteractiveDonutChart: React.FC<InteractiveDonutChartProps> = ({
  data,
  totalValue,
  centerTitle = 'Total',
  centerSubtitle,
  selectedId,
  onSelectId,
  colors,
  isDark,
  size = Math.min(220, SCREEN_WIDTH - 80),
  showLegend = true,
  emptyLabel = 'No spending recorded',
}) => {
  const outerRadius = size / 2 - 14;
  const innerRadius = outerRadius - 28;
  const center = size / 2;

  // Filter items with value > 0 for chart slices
  const validItems = useMemo(() => {
    return data.filter((item) => item.value > 0);
  }, [data]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return data.find((d) => d.id === selectedId) || null;
  }, [data, selectedId]);

  // Compute geometric paths for slices
  const slices = useMemo(() => {
    if (totalValue <= 0 || validItems.length === 0) return [];

    let currentAngle = 0;
    const isSingleSlice = validItems.length === 1;

    return validItems.map((item) => {
      const fraction = item.value / totalValue;
      const angleDelta = fraction * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleDelta;
      currentAngle = endAngle;

      const isSelected = selectedId === item.id;
      const percentage = Math.round(fraction * 100);

      if (isSingleSlice) {
        return {
          item,
          isSingle: true,
          percentage: 100,
          isSelected,
        };
      }

      // Small angular gap between slices
      const gap = Math.min(0.04, angleDelta * 0.25);
      const a1 = startAngle + gap / 2 - Math.PI / 2;
      const a2 = endAngle - gap / 2 - Math.PI / 2;

      // Subtle outward pop for selected slice
      const midAngle = (a1 + a2) / 2;
      const popDist = isSelected ? 5 : 0;
      const dx = popDist * Math.cos(midAngle);
      const dy = popDist * Math.sin(midAngle);

      const R = outerRadius + (isSelected ? 3 : 0);
      const r = innerRadius - (isSelected ? 1 : 0);

      const x1 = center + R * Math.cos(a1) + dx;
      const y1 = center + R * Math.sin(a1) + dy;
      const x2 = center + R * Math.cos(a2) + dx;
      const y2 = center + R * Math.sin(a2) + dy;
      const x3 = center + r * Math.cos(a2) + dx;
      const y3 = center + r * Math.sin(a2) + dy;
      const x4 = center + r * Math.cos(a1) + dx;
      const y4 = center + r * Math.sin(a1) + dy;

      const largeArc = a2 - a1 > Math.PI ? 1 : 0;
      const pathD = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;

      return {
        item,
        pathD,
        isSingle: false,
        percentage,
        isSelected,
      };
    });
  }, [validItems, totalValue, outerRadius, innerRadius, center, selectedId]);

  const handleToggle = (id: string) => {
    if (selectedId === id) {
      onSelectId(null);
    } else {
      onSelectId(id);
    }
  };

  return (
    <View style={styles.container}>
      {/* Donut Chart Visual & Center Display */}
      <View style={[styles.chartWrapper, { height: size, width: size }]}>
        <Svg width={size} height={size}>
          <G>
            {/* Background Empty Ring Track */}
            <Circle
              cx={center}
              cy={center}
              r={(outerRadius + innerRadius) / 2}
              stroke={isDark ? colors.surfaceContainerHigh : colors.outlineVariant}
              strokeWidth={outerRadius - innerRadius}
              fill="none"
              opacity={0.3}
            />

            {totalValue > 0 &&
              slices.map((slice) => {
                if (slice.isSingle) {
                  return (
                    <Circle
                      key={slice.item.id}
                      cx={center}
                      cy={center}
                      r={(outerRadius + innerRadius) / 2}
                      stroke={slice.item.color}
                      strokeWidth={outerRadius - innerRadius + (slice.isSelected ? 4 : 0)}
                      fill="none"
                      onPress={() => handleToggle(slice.item.id)}
                    />
                  );
                }

                return (
                  <Path
                    key={slice.item.id}
                    d={slice.pathD}
                    fill={slice.item.color}
                    opacity={selectedId ? (slice.isSelected ? 1 : 0.45) : 0.95}
                    onPress={() => handleToggle(slice.item.id)}
                  />
                );
              })}
          </G>
        </Svg>

        {/* Center Content Overlay */}
        <TouchableOpacity
          style={[styles.centerOverlay, { width: innerRadius * 2 - 8, height: innerRadius * 2 - 8 }]}
          activeOpacity={0.8}
          onPress={() => onSelectId(null)}
        >
          {selectedItem ? (
            <>
              <Text
                style={[styles.centerSubText, { color: colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {selectedItem.label}
              </Text>
              <Text style={[styles.centerMainText, { color: selectedItem.color }]}>
                {formatCurrency(selectedItem.value)}
              </Text>
              <Text style={[styles.centerPctText, { color: colors.onSurfaceVariant }]}>
                {totalValue > 0 ? Math.round((selectedItem.value / totalValue) * 100) : 0}% of total
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.centerSubText, { color: colors.onSurfaceVariant }]}>
                {centerTitle.toUpperCase()}
              </Text>
              <Text style={[styles.centerMainText, { color: colors.onSurface }]}>
                {formatCurrency(totalValue)}
              </Text>
              {centerSubtitle && (
                <Text style={[styles.centerPctText, { color: colors.onSurfaceVariant }]}>
                  {centerSubtitle}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Selected Item Detail Card */}
      {selectedItem && (
        <View
          style={[
            styles.selectedDetailCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: selectedItem.color + '60',
            },
          ]}
        >
          <View style={styles.selectedDetailLeft}>
            {selectedItem.photoUrl ? (
              <SmartImage
                uri={selectedItem.photoUrl}
                thumbnailUri={selectedItem.photoThumbnailUrl}
                name={selectedItem.label}
                size={32}
                style={styles.selectedDetailAvatar}
              />
            ) : (
              <View
                style={[
                  styles.selectedDotCircle,
                  { backgroundColor: selectedItem.color },
                ]}
              >
                {selectedItem.icon ? (
                  <MaterialIcons name={selectedItem.icon as any} size={16} color="#FFFFFF" />
                ) : (
                  <Text style={styles.selectedInitialText}>
                    {selectedItem.initials || selectedItem.label.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.selectedDetailName, { color: colors.onSurface }]}>
                {selectedItem.label}
              </Text>
              <Text style={[styles.selectedDetailSub, { color: colors.onSurfaceVariant }]}>
                {totalValue > 0 ? Math.round((selectedItem.value / totalValue) * 100) : 0}% contribution
                {selectedItem.secondaryLabel && selectedItem.secondaryAmount !== undefined
                  ? ` • ${selectedItem.secondaryLabel}: ${formatCurrency(selectedItem.secondaryAmount)}`
                  : ''}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.selectedDetailVal, { color: colors.onSurface }]}>
              {formatCurrency(selectedItem.value)}
            </Text>
            <TouchableOpacity
              onPress={() => onSelectId(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.clearBtnText, { color: colors.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Legend Rows */}
      {showLegend && data.length > 0 && (
        <View style={styles.legendContainer}>
          {data.map((item) => {
            const isSelected = selectedId === item.id;
            const pct = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.legendRow,
                  {
                    backgroundColor: isSelected
                      ? colors.surfaceContainerLow
                      : 'transparent',
                    borderColor: isSelected ? colors.primary : 'transparent',
                  },
                ]}
                onPress={() => handleToggle(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.legendLeft}>
                  {item.photoUrl ? (
                    <SmartImage
                      uri={item.photoUrl}
                      thumbnailUri={item.photoThumbnailUrl}
                      name={item.label}
                      size={24}
                      style={styles.legendAvatar}
                    />
                  ) : item.icon ? (
                    <View
                      style={[
                        styles.legendIconCircle,
                        { backgroundColor: item.color + '18' },
                      ]}
                    >
                      <MaterialIcons name={item.icon as any} size={14} color={item.color} />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.legendColorDot,
                        {
                          backgroundColor: item.color,
                          width: isSelected ? 12 : 10,
                          height: isSelected ? 12 : 10,
                        },
                      ]}
                    />
                  )}

                  <Text
                    style={[
                      styles.legendLabel,
                      {
                        color: colors.onSurface,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {item.label}
                    {item.isCurrentUser && item.label !== 'You' ? ' (You)' : ''}
                  </Text>
                </View>

                <View style={styles.legendRight}>
                  <Text
                    style={[
                      styles.legendValue,
                      {
                        color: colors.onSurface,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {formatCurrency(item.value)}
                  </Text>
                  <Text style={[styles.legendPct, { color: colors.onSurfaceVariant }]}>
                    {pct}%
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {data.length === 0 && (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
            {emptyLabel}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  chartWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  centerOverlay: {
    position: 'absolute',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  centerSubText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 2,
  },
  centerMainText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  centerPctText: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedDetailCard: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    ...Shadows.card,
  },
  selectedDetailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.sm,
  },
  selectedDetailAvatar: {
    borderRadius: 16,
  },
  selectedDotCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedInitialText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  selectedDetailName: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectedDetailSub: {
    fontSize: 11,
    marginTop: 1,
  },
  selectedDetailVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  legendContainer: {
    width: '100%',
    gap: 4,
    marginTop: Spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: Spacing.sm,
  },
  legendAvatar: {
    borderRadius: 12,
  },
  legendIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  legendColorDot: {
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 13,
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendValue: {
    fontSize: 13,
  },
  legendPct: {
    fontSize: 11,
    width: 32,
    textAlign: 'right',
  },
  emptyWrap: {
    paddingVertical: Spacing.md,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
