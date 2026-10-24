import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { BorderRadius, Spacing, Typography, Shadows } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'custom';

export interface DialogAction {
  text: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export interface DialogOptions {
  title: string;
  message?: string;
  type?: DialogType;
  icon?: keyof typeof MaterialIcons.glyphMap;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  actions?: DialogAction[];
  children?: React.ReactNode;
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
  showAlert: (title: string, message?: string, onOk?: () => void) => void;
  showSuccess: (title: string, message?: string, onOk?: () => void) => void;
  showWarning: (title: string, message?: string, onOk?: () => void) => void;
  showError: (title: string, message?: string, onOk?: () => void) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
  ) => void;
}

let globalDialogHandler: DialogContextType | null = null;

export const globalDialog = {
  alert: (
    title: string,
    message?: string,
    buttons?: Array<{ text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
    options?: any
  ) => {
    if (globalDialogHandler) {
      if (!buttons || buttons.length === 0) {
        globalDialogHandler.showAlert(title, message);
        return;
      }
      if (buttons.length === 1) {
        const btn = buttons[0];
        globalDialogHandler.showDialog({
          title,
          message,
          type: 'info',
          actions: [
            {
              text: btn.text || 'OK',
              variant: btn.style === 'destructive' ? 'destructive' : 'primary',
              onPress: btn.onPress,
            },
          ],
        });
        return;
      }
      // 2 or more buttons -> confirm / multi-choice
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      const actionBtns = buttons.filter((b) => b.style !== 'cancel');
      const primaryBtn = actionBtns[0] || buttons[0];
      const isDestructive = buttons.some((b) => b.style === 'destructive');

      globalDialogHandler.showDialog({
        title,
        message,
        type: isDestructive ? 'error' : 'confirm',
        actions: buttons.map((b) => ({
          text: b.text || 'OK',
          variant:
            b.style === 'destructive'
              ? 'destructive'
              : b.style === 'cancel'
              ? 'ghost'
              : 'primary',
          onPress: b.onPress,
        })),
      });
      return;
    }
    // Fallback if provider not yet attached
    const { Alert } = require('react-native');
    Alert.alert(title, message, buttons, options);
  },
  showSuccess: (title: string, message?: string, onOk?: () => void) => {
    globalDialogHandler?.showSuccess(title, message, onOk);
  },
  showError: (title: string, message?: string, onOk?: () => void) => {
    globalDialogHandler?.showError(title, message, onOk);
  },
  showWarning: (title: string, message?: string, onOk?: () => void) => {
    globalDialogHandler?.showWarning(title, message, onOk);
  },
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
  ) => {
    globalDialogHandler?.showConfirm(title, message, onConfirm, options);
  },
};

const DialogContext = createContext<DialogContextType | null>(null);

/**
 * Global animated customized modal/dialog provider following the SplitMate Sky-Blue brand system.
 * Replaces drab gray Android native dialogs with spring-animated, beautifully styled popups.
 */
export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors, isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<DialogOptions | null>(null);

  // Animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const dialogScale = useRef(new Animated.Value(0.85)).current;
  const dialogOpacity = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
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
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, dialogScale, dialogOpacity]);

  const animateOut = useCallback((callback?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(dialogScale, {
        toValue: 0.9,
        duration: 150,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(dialogOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setConfig(null);
      callback?.();
    });
  }, [backdropOpacity, dialogScale, dialogOpacity]);

  const showDialog = useCallback((options: DialogOptions) => {
    setConfig(options);
    setVisible(true);
    // Slight tick to ensure modal mounts before animation runs
    requestAnimationFrame(() => {
      animateIn();
    });
  }, [animateIn]);

  const hideDialog = useCallback(() => {
    animateOut();
  }, [animateOut]);

  const showAlert = useCallback((title: string, message?: string, onOk?: () => void) => {
    showDialog({
      title,
      message,
      type: 'info',
      actions: [
        {
          text: 'Got it',
          variant: 'primary',
          onPress: () => {
            onOk?.();
          },
        },
      ],
    });
  }, [showDialog]);

  const showSuccess = useCallback((title: string, message?: string, onOk?: () => void) => {
    showDialog({
      title,
      message,
      type: 'success',
      actions: [
        {
          text: 'Great',
          variant: 'primary',
          onPress: () => {
            onOk?.();
          },
        },
      ],
    });
  }, [showDialog]);

  const showError = useCallback((title: string, message?: string, onOk?: () => void) => {
    showDialog({
      title,
      message,
      type: 'error',
      actions: [
        {
          text: 'Dismiss',
          variant: 'primary',
          onPress: () => {
            onOk?.();
          },
        },
      ],
    });
  }, [showDialog]);

  const showWarning = useCallback((title: string, message?: string, onOk?: () => void) => {
    showDialog({
      title,
      message,
      type: 'warning',
      actions: [
        {
          text: 'Got it',
          variant: 'primary',
          onPress: () => {
            onOk?.();
          },
        },
      ],
    });
  }, [showDialog]);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
  ) => {
    showDialog({
      title,
      message,
      type: options?.destructive ? 'error' : 'confirm',
      actions: [
        {
          text: options?.cancelText || 'Cancel',
          variant: 'ghost',
        },
        {
          text: options?.confirmText || 'Confirm',
          variant: options?.destructive ? 'destructive' : 'primary',
          onPress: onConfirm,
        },
      ],
    });
  }, [showDialog]);

  // Keep global handler synchronized for any non-hook access
  React.useEffect(() => {
    globalDialogHandler = {
      showDialog,
      hideDialog,
      showAlert,
      showSuccess,
      showWarning,
      showError,
      showConfirm,
    };
    return () => {
      globalDialogHandler = null;
    };
  }, [showDialog, hideDialog, showAlert, showSuccess, showWarning, showError, showConfirm]);

  // Determine badge styling and icon based on dialog type
  const getTypeConfig = (type: DialogType = 'info', customIcon?: keyof typeof MaterialIcons.glyphMap) => {
    switch (type) {
      case 'success':
        return {
          icon: customIcon || ('check-circle' as const),
          color: isDark ? '#34D399' : '#059669',
          bg: isDark ? 'rgba(5, 150, 105, 0.2)' : '#DCFCE7',
          badgeBorder: isDark ? '#059669' : '#BBF7D0',
        };
      case 'warning':
        return {
          icon: customIcon || ('warning' as const),
          color: isDark ? '#FBBF24' : '#D97706',
          bg: isDark ? 'rgba(217, 119, 6, 0.2)' : '#FEF3C7',
          badgeBorder: isDark ? '#D97706' : '#FDE68A',
        };
      case 'error':
        return {
          icon: customIcon || ('error-outline' as const),
          color: isDark ? '#F87171' : '#DC2626',
          bg: isDark ? 'rgba(220, 38, 38, 0.2)' : '#FEE2E2',
          badgeBorder: isDark ? '#DC2626' : '#FECACA',
        };
      case 'confirm':
        return {
          icon: customIcon || ('help-outline' as const),
          color: colors.primary,
          bg: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE',
          badgeBorder: isDark ? colors.primary : '#BAE6FD',
        };
      case 'info':
      default:
        return {
          icon: customIcon || ('info-outline' as const),
          color: colors.primary,
          bg: isDark ? 'rgba(56, 189, 248, 0.2)' : '#E0F2FE',
          badgeBorder: isDark ? colors.primary : '#BAE6FD',
        };
    }
  };

  const typeConfig = getTypeConfig(config?.type, config?.icon);

  // Compute actions
  const actions: DialogAction[] = config?.actions || [
    {
      text: 'OK',
      variant: 'primary',
      onPress: () => {},
    },
  ];

  return (
    <DialogContext.Provider
      value={{
        showDialog,
        hideDialog,
        showAlert,
        showSuccess,
        showWarning,
        showError,
        showConfirm,
      }}
    >
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={hideDialog}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={hideDialog}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <Animated.View
                style={[
                  styles.dialogCard,
                  {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderColor: colors.divider,
                    opacity: dialogOpacity,
                    transform: [{ scale: dialogScale }],
                  },
                ]}
              >
                {/* Visual Icon Badge */}
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: typeConfig.bg,
                      borderColor: typeConfig.badgeBorder,
                    },
                  ]}
                >
                  <MaterialIcons name={typeConfig.icon} size={32} color={typeConfig.color} />
                </View>

                {/* Title & Message */}
                <Text style={[styles.title, { color: colors.onSurface }]}>
                  {config?.title}
                </Text>
                {!!config?.message && (
                  <Text style={[styles.message, { color: colors.onSurfaceVariant }]}>
                    {config.message}
                  </Text>
                )}

                {/* Optional Custom Content */}
                {config?.children}

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                  {actions.map((act, index) => {
                    const isPrimary = act.variant === 'primary' || !act.variant;
                    const isDestructive = act.variant === 'destructive';
                    const isOutline = act.variant === 'outline';
                    const isGhost = act.variant === 'ghost' || act.variant === 'secondary';

                    let btnBg = colors.primary;
                    let textColor = colors.onPrimary;
                    let btnBorder = 'transparent';

                    if (isDestructive) {
                      btnBg = colors.error;
                      textColor = colors.onError;
                    } else if (isOutline) {
                      btnBg = 'transparent';
                      textColor = colors.primary;
                      btnBorder = colors.primary;
                    } else if (isGhost) {
                      btnBg = isDark ? colors.surfaceContainerHigh : colors.surfaceContainerLow;
                      textColor = colors.onSurface;
                    }

                    return (
                      <TouchableOpacity
                        key={index}
                        activeOpacity={0.8}
                        style={[
                          styles.actionBtn,
                          {
                            backgroundColor: btnBg,
                            borderColor: btnBorder,
                            borderWidth: isOutline ? 1.5 : 0,
                          },
                          actions.length > 2 && { width: '100%', marginBottom: 8 },
                        ]}
                        onPress={() => {
                          animateOut(() => {
                            act.onPress?.();
                          });
                        }}
                      >
                        {act.icon && (
                          <MaterialIcons
                            name={act.icon}
                            size={18}
                            color={textColor}
                            style={{ marginRight: 6 }}
                          />
                        )}
                        <Text style={[styles.actionBtnText, { color: textColor }]}>
                          {act.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
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
  actionsContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    ...Shadows.button,
  },
  actionBtnText: {
    ...Typography.titleSm,
    fontWeight: '700',
  },
});
