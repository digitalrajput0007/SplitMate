import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { mediaService } from '../services/media/mediaService';
import { imageProcessor } from '../services/media/imageProcessor';
import * as Crypto from 'expo-crypto';

export type MediaPurpose = 'profile' | 'group' | 'receipt';

interface UseMediaManagerOptions {
  purpose: MediaPurpose;
  id: string; // userId or groupId
  onSuccess: (urls: { original: string; thumbnail?: string; metadata?: any }) => void;
  previousUrls?: { original?: string; thumbnail?: string };
}

/**
 * Media Manager Hook (Phase 2)
 * Handles dual-layer processing, background uploads, and atomic cleanup.
 * Standard implementation using verified installed dependencies.
 */
export function useMediaManager({ purpose, id, onSuccess, previousUrls }: UseMediaManagerOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  /**
   * Orchestrator: Processes and Uploads
   */
  const handleMediaSelection = async (uri: string) => {
    setIsPickerVisible(false);

    try {
      // 1. Validation & Info
      const { size, exists } = await mediaService.getInfo(uri);
      if (!exists) throw new Error('File not found');
      if (size > 20 * 1024 * 1024) {
        Alert.alert('File Too Large', 'Maximum allowed size is 20MB.');
        return;
      }

      setIsUploading(true);
      setProgress(0);

      const uuid = Crypto.randomUUID ? Crypto.randomUUID() : Math.random().toString(36).substring(7);
      const isPdf = uri.toLowerCase().endsWith('.pdf');

      // 2. Dual-Layer Processing
      if (purpose === 'receipt') {
        const processed = isPdf ? { uri, width: 0, height: 0, mimeType: 'application/pdf' } : await imageProcessor.processReceipt(uri);
        const ext = isPdf ? 'pdf' : 'jpg';
        const path = `receipts/${id}/${uuid}.${ext}`;

        const downloadUrl = await mediaService.uploadFile(processed.uri, path, (p) => setProgress(p.progress));

        onSuccess({
          original: downloadUrl,
          metadata: { ...processed, fileSize: size, createdAt: Date.now() }
        });
      } else {
        const { original, thumbnail } = await imageProcessor.processSquareImage(uri, purpose);
        const folder = purpose === 'profile' ? 'profile_photos' : 'group_photos';

        const originalUrl = await mediaService.uploadFile(
          original.uri,
          `${folder}/${id}/${uuid}_full.jpg`,
          (p) => setProgress(p.progress * 0.8)
        );

        const thumbUrl = await mediaService.uploadFile(
          thumbnail.uri,
          `${folder}/${id}/${uuid}_thumb.jpg`,
          (p) => setProgress(80 + (p.progress * 0.2))
        );

        onSuccess({
          original: originalUrl,
          thumbnail: thumbUrl,
          metadata: {
            ...original,
            thumbnailSize: thumbnail.fileSize || 0, // Ensure no undefined
            createdAt: Date.now()
          }
        });
      }

      // 3. Atomic Cleanup of Old Assets (Async, Non-blocking)
      if (previousUrls) {
        if (previousUrls.original) mediaService.deleteFile(previousUrls.original);
        if (previousUrls.thumbnail) mediaService.deleteFile(previousUrls.thumbnail);
      }

    } catch (error) {
      console.error('MediaManager: Global Failure', error);
      Alert.alert('Upload Error', 'We could not process your image. Please try again.');
    } finally {
      setIsUploading(false);
      setProgress(100);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  /**
   * Action: Remove existing media
   */
  const removeMedia = async () => {
    onSuccess({ original: '', thumbnail: '' });
    if (previousUrls) {
      if (previousUrls.original) mediaService.deleteFile(previousUrls.original);
      if (previousUrls.thumbnail) mediaService.deleteFile(previousUrls.thumbnail);
    }
  };

  /**
   * Standard Pickers
   */
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Error', 'Camera access denied');

      const isReceipt = purpose === 'receipt';
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: !isReceipt,
        aspect: isReceipt ? undefined : [1, 1],
        quality: 1,
      });

      if (!result.canceled) handleMediaSelection(result.assets[0].uri);
    } catch (e) {
      console.error('takePhoto error:', e);
      Alert.alert('Error', 'Unable to access camera.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const isReceipt = purpose === 'receipt';
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: !isReceipt,
        aspect: isReceipt ? undefined : [1, 1],
        quality: 1,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled) handleMediaSelection(result.assets[0].uri);
    } catch (e) {
      console.error('pickFromGallery error:', e);
      Alert.alert('Error', 'Unable to access gallery.');
    }
  };

  return {
    isUploading,
    progress,
    isPickerVisible,
    setIsPickerVisible,
    takePhoto,
    pickFromGallery,
    removeMedia,
  };
}
