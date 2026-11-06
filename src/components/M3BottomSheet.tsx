import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Typography, BorderRadius, Shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export interface M3BottomSheetProps {
  visible: boolean;
  onDismiss?: () => void;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
}

export function M3BottomSheet({ visible, onDismiss, onClose, title, children }: M3BottomSheetProps) {
  const { colors } = useTheme();
  const handleClose = onClose || onDismiss || (() => {});

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    } else {
      translateY.setValue(SCREEN_HEIGHT);
    }
  }, [visible]);

  const dismissWithAnimation = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      handleClose();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          dismissWithAnimation();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismissWithAnimation}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={dismissWithAnimation}
      >
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceContainerLowest, transform: [{ translateY }] },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Premium Drag Header */}
          <View style={styles.dragHeaderArea} {...panResponder.panHandlers}>
            <View style={[styles.handle, { backgroundColor: colors.outlineVariant }]} />
            {title && <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>}
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '82%',
    ...Shadows.dialog,
  },
  dragHeaderArea: {
    width: '100%',
    paddingBottom: 8,
    alignItems: 'center',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: { ...Typography.titleMd, fontWeight: '700', alignSelf: 'flex-start', marginBottom: 8 },
  content: { gap: 16 },
});
