import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, Animated, Easing } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography } from '../theme';

export type SplitMateIllustrationType = 'split' | 'settle' | 'groups';

interface IllustrationProps {
  type: SplitMateIllustrationType;
}

/**
 * Modern Google/Finlume-style vector-like interactive illustration for SplitMate.
 * Features animated floating badges, subtle breathing pulse circles, and vivid sky-blue branding.
 */
export const OnboardingIllustration: React.FC<IllustrationProps> = ({ type }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Gentle floating loop
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -8,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Subtle breathing pulse loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [floatAnim, pulseAnim]);

  // Slide 1: Instant Bill Splitting
  if (type === 'split') {
    return (
      <View style={styles.artContainer}>
        {/* Soft pastel ambient backdrops */}
        <Animated.View style={[styles.ambientCircle, styles.ambientBlue, { transform: [{ scale: pulseAnim }] }]} />
        <View style={[styles.ambientCircle, styles.ambientCyan]} />

        {/* Central visual card representing an expense split receipt */}
        <Animated.View style={[styles.cardBase, { transform: [{ translateY: floatAnim }] }]}>
          {/* Card Top bar with bill icon */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.pillIconBubble}>
              <MaterialIcons name="receipt-long" size={18} color="#0284C7" />
            </View>
            <View style={styles.headerTextGroup}>
              <Text style={styles.cardTitle}>Weekend Dinner & Drinks</Text>
              <Text style={styles.cardSub}>Total Bill: ₹3,600</Text>
            </View>
          </View>

          {/* Members Split Grid */}
          <View style={styles.splitRow}>
            <View style={styles.splitMemberPill}>
              <View style={[styles.memberAvatarCircle, { backgroundColor: '#E0F2FE' }]}>
                <Text style={styles.memberInitial}>Y</Text>
              </View>
              <Text style={styles.memberShare}>₹1,200</Text>
            </View>

            <View style={styles.splitMemberPill}>
              <View style={[styles.memberAvatarCircle, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.memberInitial, { color: '#16A34A' }]}>R</Text>
              </View>
              <Text style={styles.memberShare}>₹1,200</Text>
            </View>

            <View style={styles.splitMemberPill}>
              <View style={[styles.memberAvatarCircle, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.memberInitial, { color: '#D97706' }]}>S</Text>
              </View>
              <Text style={styles.memberShare}>₹1,200</Text>
            </View>
          </View>

          {/* Equal split pill status */}
          <View style={styles.splitTag}>
            <MaterialIcons name="pie-chart" size={15} color="#0284C7" />
            <Text style={styles.splitTagText}>Split equally between 3 members</Text>
          </View>
        </Animated.View>

        {/* Floating Satellite Badge */}
        <Animated.View
          style={[
            styles.satelliteBadge,
            styles.satelliteTopRight,
            { transform: [{ translateY: Animated.multiply(floatAnim, -1) }] },
          ]}
        >
          <MaterialIcons name="bolt" size={18} color="#0284C7" />
          <Text style={styles.satelliteText}>Instant Split</Text>
        </Animated.View>
      </View>
    );
  }

  // Slide 2: 1-Tap UPI Settlement
  if (type === 'settle') {
    return (
      <View style={styles.artContainer}>
        {/* Soft pastel ambient backdrops */}
        <Animated.View style={[styles.ambientCircle, styles.ambientEmerald, { transform: [{ scale: pulseAnim }] }]} />
        <View style={[styles.ambientCircle, styles.ambientTeal]} />

        {/* Central visual card representing UPI Payment Settlement */}
        <Animated.View style={[styles.cardBase, { transform: [{ translateY: floatAnim }] }]}>
          {/* Settle Action Row */}
          <View style={styles.settleRow}>
            <View style={[styles.settleIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <MaterialIcons name="check" size={24} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settleTitle}>Settled up with Rahul</Text>
              <Text style={styles.settleSub}>Via Google Pay / PhonePe UPI</Text>
            </View>
            <Text style={styles.settleAmount}>₹850</Text>
          </View>

          <View style={styles.divider} />

          {/* Zero Debt Status Pill */}
          <View style={styles.settleBottomRow}>
            <View style={styles.upiPill}>
              <Text style={styles.upiText}>UPI Deep Link</Text>
            </View>
            <View style={styles.zeroDebtBadge}>
              <MaterialIcons name="done-all" size={14} color="#059669" />
              <Text style={styles.zeroDebtText}>Zero Balance</Text>
            </View>
          </View>
        </Animated.View>

        {/* Floating Satellite Badge */}
        <Animated.View
          style={[
            styles.satelliteBadge,
            styles.satelliteBottomLeft,
            { transform: [{ translateY: Animated.multiply(floatAnim, -0.8) }] },
          ]}
        >
          <MaterialIcons name="payments" size={18} color="#059669" />
          <Text style={[styles.satelliteText, { color: '#047857' }]}>1-Tap UPI</Text>
        </Animated.View>
      </View>
    );
  }

  // Slide 3: Smart Group Tracking & Simplification
  return (
    <View style={styles.artContainer}>
      {/* Soft pastel ambient backdrops */}
      <Animated.View style={[styles.ambientCircle, styles.ambientIndigo, { transform: [{ scale: pulseAnim }] }]} />
      <View style={[styles.ambientCircle, styles.ambientSky]} />

      {/* Central visual card representing group balance optimization */}
      <Animated.View style={[styles.cardBase, { transform: [{ translateY: floatAnim }] }]}>
        <View style={styles.groupHeader}>
          <View style={[styles.pillIconBubble, { backgroundColor: '#EEF2FF' }]}>
            <MaterialIcons name="groups" size={18} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Trip to Goa & Flatmates</Text>
            <Text style={styles.cardSub}>5 Active Members • 12 Expenses</Text>
          </View>
        </View>

        {/* Smart Algorithm Flow Preview */}
        <View style={styles.smartDebtRow}>
          <View style={styles.debtNode}>
            <Text style={styles.debtNodeName}>Amit</Text>
            <Text style={styles.debtNodeSub}>Owes ₹1,400</Text>
          </View>
          <View style={styles.debtArrowWrapper}>
            <MaterialIcons name="trending-flat" size={24} color="#0284C7" />
            <Text style={styles.debtArrowLabel}>Optimized</Text>
          </View>
          <View style={styles.debtNode}>
            <Text style={styles.debtNodeName}>Priya</Text>
            <Text style={[styles.debtNodeSub, { color: '#16A34A' }]}>Gets ₹1,400</Text>
          </View>
        </View>

        {/* Algorithm Highlight Banner */}
        <View style={styles.smartTag}>
          <MaterialIcons name="auto-awesome" size={15} color="#4F46E5" />
          <Text style={styles.smartTagText}>Minimal transactions across members</Text>
        </View>
      </Animated.View>

      {/* Floating Satellite Badge */}
      <Animated.View
        style={[
          styles.satelliteBadge,
          styles.satelliteTopRight,
          { transform: [{ translateY: Animated.multiply(floatAnim, -1.2) }] },
        ]}
      >
        <MaterialIcons name="auto-graph" size={18} color="#4F46E5" />
        <Text style={[styles.satelliteText, { color: '#4338CA' }]}>Simplified Debts</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  artContainer: {
    width: '100%',
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ambientCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  ambientBlue: {
    width: 220,
    height: 220,
    backgroundColor: 'rgba(224, 242, 254, 0.75)',
    top: 5,
  },
  ambientCyan: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(207, 250, 254, 0.65)',
    right: 25,
    bottom: 10,
  },
  ambientEmerald: {
    width: 210,
    height: 210,
    backgroundColor: 'rgba(209, 250, 229, 0.8)',
    top: 6,
  },
  ambientTeal: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(204, 251, 241, 0.7)',
    left: 25,
    bottom: 12,
  },
  ambientIndigo: {
    width: 220,
    height: 220,
    backgroundColor: 'rgba(238, 242, 255, 0.85)',
    top: 5,
  },
  ambientSky: {
    width: 140,
    height: 140,
    backgroundColor: 'rgba(224, 242, 254, 0.7)',
    right: 30,
    bottom: 12,
  },
  cardBase: {
    width: '88%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  pillIconBubble: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  splitMemberPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  memberAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  memberInitial: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
  memberShare: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  splitTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  splitTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
  },
  settleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  settleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  settleSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  settleAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#16A34A',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  settleBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upiPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  upiText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  zeroDebtBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  zeroDebtText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  smartDebtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  debtNode: {
    alignItems: 'center',
  },
  debtNodeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  debtNodeSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 2,
  },
  debtArrowWrapper: {
    alignItems: 'center',
  },
  debtArrowLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    textTransform: 'uppercase',
  },
  smartTag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  smartTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
  },
  satelliteBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  satelliteTopRight: {
    top: 12,
    right: 18,
  },
  satelliteBottomLeft: {
    bottom: 12,
    left: 20,
  },
  satelliteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
  },
});
