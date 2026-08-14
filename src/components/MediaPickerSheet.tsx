import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { M3BottomSheet } from './M3BottomSheet';
import { Typography, Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export interface MediaPickerSheetProps {
  visible: boolean;
  onDismiss: () => void;
  onCamera: () => void;
  onGallery: () => void;
  onFiles?: () => void;
  onRemove?: () => void;
  title?: string;
}

export function MediaPickerSheet({
  visible,
  onDismiss,
  onCamera,
  onGallery,
  onFiles,
  onRemove,
  title = 'Change Photo',
}: MediaPickerSheetProps) {
  const { colors } = useTheme();

  return (
    <M3BottomSheet visible={visible} onDismiss={onDismiss} title={title}>
      <View style={styles.list}>
        <OptionItem
          icon="photo-camera"
          label="Take Photo"
          onPress={() => { onCamera(); onDismiss(); }}
          colors={colors}
        />
        <OptionItem
          icon="photo-library"
          label="Choose from Gallery"
          onPress={() => { onGallery(); onDismiss(); }}
          colors={colors}
        />
        {onFiles && (
          <OptionItem
            icon="folder-open"
            label="Browse Files"
            onPress={() => { onFiles(); onDismiss(); }}
            colors={colors}
          />
        )}
        {onRemove && (
          <OptionItem
            icon="delete-outline"
            label="Remove Photo"
            onPress={() => { onRemove(); onDismiss(); }}
            colors={colors}
            isDestructive
          />
        )}
      </View>
    </M3BottomSheet>
  );
}

function OptionItem({
  icon,
  label,
  onPress,
  colors,
  isDestructive
}: {
  icon: keyof typeof MaterialIcons.glyphMap,
  label: string,
  onPress: () => void,
  colors: any,
  isDestructive?: boolean
}) {
  return (
    <TouchableOpacity
      style={styles.option}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: isDestructive ? colors.errorContainer : colors.surfaceContainerLow }]}>
        <MaterialIcons
          name={icon}
          size={22}
          color={isDestructive ? colors.error : colors.primary}
        />
      </View>
      <Text style={[styles.label, { color: isDestructive ? colors.error : colors.onSurface }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...Typography.titleMd,
    fontWeight: '500',
  },
});
