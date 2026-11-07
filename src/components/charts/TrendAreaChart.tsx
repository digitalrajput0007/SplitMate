import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, G, Rect } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { formatCurrency } from '../../services/firestoreService';
import { Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import { LightColors } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface MonthlyTrendItem {
  monthKey: string; // 'YYYY-MM'
  label: string;    // 'Nov'
  year: number;
  month: number;
  totalSpend: number;
  userShare: number;
}

interface TrendAreaChartProps {
  data: MonthlyTrendItem[];
  viewMonths: 6 | 12;
  onChangeViewMonths: (months: 6 | 12) => void;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  colors: typeof LightColors;
  isDark: boolean;
  monthComparison?: {
    changePercent: number;
    direction: 'up' | 'down' | 'flat';
    currentVal: number;
    prevVal: number;
  } | null;
}

export const TrendAreaChart: React.FC<TrendAreaChartProps> = ({
  data,
  viewMonths,
  onChangeViewMonths,
  selectedIndex,
  onSelectIndex,
  colors,
  isDark,
  monthComparison,
}) => {
  const chartWidth = Math.max(280, SCREEN_WIDTH - Spacing.md * 2 - 32);
  const chartHeight = 150;
  const paddingLeft = 14;
  const paddingRight = 14;
  const paddingTop = 16;
  const paddingBottom = 26;

  const usableWidth = chartWidth - paddingLeft - paddingRight;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  // Maximum value for scaling (min 1 to avoid / 0)
  const maxValue = useMemo(() => {
    const max = Math.max(...data.map((d) => d.totalSpend), 1);
    // Add 10% headroom
    return Math.ceil(max * 1.1);
  }, [data]);

  // Compute (x, y) coordinates for each point
  const points = useMemo(() => {
    if (data.length === 0) return [];
    const stepX = data.length > 1 ? usableWidth / (data.length - 1) : usableWidth / 2;

    return data.map((d, i) => {
      const x = paddingLeft + (data.length > 1 ? i * stepX : usableWidth / 2);
      const ratio = Math.min(1, Math.max(0, d.totalSpend / maxValue));
      const y = paddingTop + (1 - ratio) * usableHeight;
      return { x, y, data: d, index: i };
    });
  }, [data, maxValue, usableWidth, usableHeight, paddingLeft, paddingTop]);

  // Construct smooth cubic Bezier path
  const { linePath, areaPath } = useMemo(() => {
    if (points.length === 0) return { linePath: '', areaPath: '' };
    if (points.length === 1) {
      const p = points[0];
      return {
        linePath: `M ${paddingLeft} ${p.y} L ${chartWidth - paddingRight} ${p.y}`,
        areaPath: `M ${paddingLeft} ${paddingTop + usableHeight} L ${paddingLeft} ${p.y} L ${chartWidth - paddingRight} ${p.y} L ${chartWidth - paddingRight} ${paddingTop + usableHeight} Z`,
      };
    }

    let line = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const baselineY = paddingTop + usableHeight;
      // Natural cubic spline tension clamped to chart bounds
      const cp1x = p1.x + (p2.x - p0.x) / 4;
      const cp1y = Math.min(baselineY, Math.max(paddingTop, p1.y + (p2.y - p0.y) / 4));
      const cp2x = p2.x - (p3.x - p1.x) / 4;
      const cp2y = Math.min(baselineY, Math.max(paddingTop, p2.y - (p3.y - p1.y) / 4));

      line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const baselineY = paddingTop + usableHeight;
    const area = `${line} L ${points[points.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${points[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`;

    return { linePath: line, areaPath: area };
  }, [points, paddingLeft, paddingRight, paddingTop, usableHeight, chartWidth]);

  const selectedPoint = selectedIndex !== null && points[selectedIndex] ? points[selectedIndex] : null;

  return (
    <View style={styles.container}>
      {/* Header controls: Title and 6M / 12M toggle */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.onSurface }]}>Monthly Spending Trend</Text>
          <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
            {viewMonths === 6 ? 'Past 6 months' : 'Past 12 months'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {monthComparison && (
            <View
              style={[
                styles.trendBadge,
                {
                  backgroundColor:
                    monthComparison.direction === 'up'
                      ? '#F59E0B' + '20'
                      : monthComparison.direction === 'down'
                      ? '#10B981' + '20'
                      : colors.surfaceContainerLow,
                },
              ]}
            >
              <MaterialIcons
                name={
                  monthComparison.direction === 'up'
                    ? 'north'
                    : monthComparison.direction === 'down'
                    ? 'south'
                    : 'remove'
                }
                size={12}
                color={
                  monthComparison.direction === 'up'
                    ? '#F59E0B'
                    : monthComparison.direction === 'down'
                    ? '#10B981'
                    : colors.onSurfaceVariant
                }
              />
              <Text
                style={[
                  styles.trendBadgeText,
                  {
                    color:
                      monthComparison.direction === 'up'
                        ? '#F59E0B'
                        : monthComparison.direction === 'down'
                        ? '#10B981'
                        : colors.onSurfaceVariant,
                  },
                ]}
              >
                {monthComparison.direction === 'flat'
                  ? '0% vs mo'
                  : `${monthComparison.changePercent}% vs mo`}
              </Text>
            </View>
          )}

          {/* 6M / 12M Toggle */}
          <View
            style={[
              styles.viewToggleWrap,
              { backgroundColor: colors.surfaceContainerLow, borderColor: colors.divider },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.viewToggleBtn,
                viewMonths === 6 && [
                  styles.viewToggleBtnActive,
                  { backgroundColor: colors.primary },
                ],
              ]}
              onPress={() => onChangeViewMonths(6)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  { color: viewMonths === 6 ? colors.onPrimary : colors.onSurfaceVariant },
                  viewMonths === 6 && { fontWeight: '700' },
                ]}
              >
                6M
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.viewToggleBtn,
                viewMonths === 12 && [
                  styles.viewToggleBtnActive,
                  { backgroundColor: colors.primary },
                ],
              ]}
              onPress={() => onChangeViewMonths(12)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  { color: viewMonths === 12 ? colors.onPrimary : colors.onSurfaceVariant },
                  viewMonths === 12 && { fontWeight: '700' },
                ]}
              >
                12M
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Interactive SVG Area Chart */}
      <View style={[styles.svgWrapper, { width: chartWidth, height: chartHeight }]}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {/* Horizontal Reference Grid Lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = paddingTop + (1 - ratio) * usableHeight;
            return (
              <Line
                key={ratio}
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke={isDark ? colors.outlineVariant : colors.divider}
                strokeWidth={1}
                strokeDasharray={[4, 4]}
                opacity={0.6}
              />
            );
          })}

          {/* Gradient Filled Area */}
          {areaPath ? <Path d={areaPath} fill="url(#trendGradient)" /> : null}

          {/* Smooth Stroke Line */}
          {linePath ? (
            <Path
              d={linePath}
              stroke={colors.primary}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}

          {/* Selected Month Vertical Guide Line */}
          {selectedPoint && (
            <Line
              x1={selectedPoint.x}
              y1={paddingTop}
              x2={selectedPoint.x}
              y2={paddingTop + usableHeight}
              stroke={colors.secondary}
              strokeWidth={1.5}
              strokeDasharray={[3, 3]}
            />
          )}

          {/* Interactive Data Point Dots */}
          {points.map((pt) => {
            const isSelected = selectedIndex === pt.index;

            return (
              <G key={pt.data.monthKey} onPress={() => onSelectIndex(isSelected ? null : pt.index)}>
                {/* Invisible large touch target */}
                <Circle cx={pt.x} cy={pt.y} r={18} fill="transparent" />

                {isSelected && (
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r={12}
                    fill={colors.primary}
                    opacity={0.25}
                  />
                )}

                <Circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 6 : 4}
                  fill={isSelected ? colors.secondary : colors.primary}
                  stroke={isDark ? '#090D16' : '#FFFFFF'}
                  strokeWidth={2}
                />
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Month Labels Axis */}
      <View style={[styles.labelsRow, { paddingHorizontal: paddingLeft - 4 }]}>
        {data.map((item, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <TouchableOpacity
              key={item.monthKey}
              style={styles.labelCol}
              onPress={() => onSelectIndex(isSelected ? null : idx)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.monthLabel,
                  {
                    color: isSelected ? colors.primary : colors.onSurfaceVariant,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Month Tooltip Card */}
      {selectedPoint && (
        <View
          style={[
            styles.tooltipCard,
            {
              backgroundColor: colors.surfaceContainerLow,
              borderColor: colors.primary,
            },
          ]}
        >
          <View style={styles.tooltipHeader}>
            <Text style={[styles.tooltipMonth, { color: colors.onSurface }]}>
              {selectedPoint.data.label} {selectedPoint.data.year}
            </Text>
            <TouchableOpacity onPress={() => onSelectIndex(null)}>
              <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <View style={styles.tooltipValues}>
            <View>
              <Text style={[styles.tooltipSub, { color: colors.onSurfaceVariant }]}>Total Spend</Text>
              <Text style={[styles.tooltipVal, { color: colors.onSurface }]}>
                {formatCurrency(selectedPoint.data.totalSpend)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.tooltipSub, { color: colors.onSurfaceVariant }]}>Your Share</Text>
              <Text style={[styles.tooltipVal, { color: colors.primary }]}>
                {formatCurrency(selectedPoint.data.userShare)}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.titleSm,
    fontWeight: '700',
    fontSize: 15,
  },
  subtitle: {
    ...Typography.bodySm,
    fontSize: 11,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  trendBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewToggleWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 2,
  },
  viewToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  viewToggleBtnActive: {},
  viewToggleText: {
    fontSize: 10,
    fontWeight: '600',
  },
  svgWrapper: {
    alignSelf: 'center',
    marginTop: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  labelCol: {
    alignItems: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  monthLabel: {
    fontSize: 10,
  },
  tooltipCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
    ...Shadows.card,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tooltipMonth: {
    fontWeight: '700',
    fontSize: 12,
  },
  tooltipValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tooltipSub: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  tooltipVal: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
});
