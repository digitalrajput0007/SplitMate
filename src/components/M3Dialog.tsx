import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Typography, BorderRadius, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface M3DialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
  destructive?: boolean;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export function M3Dialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onDismiss,
  destructive = false,
  type,
  icon,
}: M3DialogProps) {
  const { colors, isDark } = useTheme();

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dialogScale = useRef(new Animated.Value(0.85)).current;
  const dialogOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      dialogScale.setValue(0.85);
      dialogOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(dialogScale, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(dialogOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdropOpacity, dialogScale, dialogOpacity]);

  if (!visible) return null;

  const resolvedType = type || (destructive ? 'error' : 'info');

  const getBadgeConfig = () => {
    if (resolvedType === 'error') {
      return {
        icon: icon || ('error-outline' as const),
        color: isDark ? '#F87171' : '#DC2626',
        bg: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
        border: isDark ? '#DC2626' : '#FECACA',
      };
    }
    if (resolvedType === 'success') {
      return {
        icon: icon || ('check-circle' as const),
        color: isDark ? '#34D399' : '#059669',
        bg: isDark ? 'rgba(5, 150, 105, 0.2)' : '#DCFCE7',
        border: isDark ? '#059669' : '#BBF7D0',
      };
    }
    if (resolvedType === 'warning') {
      return {
        icon: icon || ('warning' as const),
        color: isDark ? '#FBBF24' : '#D97706',
        bg: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7',
        border: isDark ? '#D97706' : '#FDE68A',
      };
    }
    return {
      icon: icon || ('info-outline' as const),
      color: colors.primary,
      bg: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE',
      border: isDark ? colors.primary : '#BAE6FD',
    };
  };

  const badgeConfig = getBadgeConfig();

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(dialogScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(dialogOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const handleConfirm = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(dialogScale, {
        toValue: 0.9,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(dialogOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onConfirm();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceContainerLowest,
                  borderColor: colors.divider,
                  opacity: dialogOpacity,
                  transform: [{ scale: dialogScale }],
                },
              ]}
            >
              {/* Animated Visual Brand Badge */}
              <View
                style={[
                  styles.iconBadge,
                  {
                    backgroundColor: badgeConfig.bg,
                    borderColor: badgeConfig.border,
                  },
                ]}
              >
                <MaterialIcons name={badgeConfig.icon} size={32} color={badgeConfig.color} />
              </View>

              <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
              <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>{message}</Text>

              <View style={styles.actions}>
                {cancelLabel ? (
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surfaceContainerLow }]}
                    onPress={handleDismiss}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.btnText, { color: colors.onSurface }]}>{cancelLabel}</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.btn,
                    {
                      backgroundColor: destructive ? colors.error : colors.primary,
                      flex: cancelLabel ? 1 : 0,
                      minWidth: cancelLabel ? undefined : 120,
                    },
                  ]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnText, { color: destructive ? colors.onError : colors.onPrimary }]}>
                    {confirmLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xxl,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    ...Shadows.dialog,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
  },
  title: {
    ...Typography.titleLg,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    ...Typography.bodyMd,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    ...Shadows.button,
  },
  btnText: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
});
