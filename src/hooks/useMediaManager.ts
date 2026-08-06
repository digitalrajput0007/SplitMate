import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { mediaService, UploadProgress } from '../services/media/mediaService';
import { imageProcessor } from '../services/media/imageProcessor';
import * as Crypto from 'expo-crypto';

// Defensive require for expo-document-picker
let DocumentPicker: any = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  console.warn('useMediaManager: expo-document-picker not found');
}

export type MediaPurpose = 'profile' | 'group' | 'receipt';

interface UseMediaManagerOptions {
  purpose: MediaPurpose;
  id: string; // userId or groupId
  onSuccess: (urls: { original: string; thumbnail?: string }) => void;
  previousUrls?: { original?: string; thumbnail?: string };
}

export function useMediaManager({ purpose, id, onSuccess, previousUrls }: UseMediaManagerOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPickerVisible, setIsPickerVisible] = useState(false);

  /**
   * Selection: Camera
   */
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'SplitMate needs camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      handleMediaSelection(result.assets[0].uri);
    }
  };

  /**
   * Selection: Gallery
   */
  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });

    if (!result.canceled) {
      handleMediaSelection(result.assets[0].uri);
    }
  };

  /**
   * Selection: File Browser (PDF support for receipts)
   */
  const browseFiles = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: purpose === 'receipt' ? ['image/*', 'application/pdf'] : 'image/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      handleMediaSelection(result.assets[0].uri);
    }
  };

  /**
   * Action: Remove existing media
   */
  const removeMedia = async () => {
    try {
      setIsUploading(true);
      setProgress(0);

      // 1. Success Callback with empty strings
      onSuccess({ original: '', thumbnail: '' });

      // 2. Cleanup Previous Assets from Storage (Async, non-blocking)
      if (previousUrls) {
        if (previousUrls.original) mediaService.deleteFile(previousUrls.original);
        if (previousUrls.thumbnail) mediaService.deleteFile(previousUrls.thumbnail);
      }
    } catch (error) {
      console.error('MediaManager: Removal failed', error);
    } finally {
      setIsUploading(false);
      setProgress(100);
    }
  };

  /**
   * Pipeline Orchestrator
   */
  const handleMediaSelection = async (uri: string) => {
    setIsPickerVisible(false);

    // 1. Validation
    const size = await mediaService.getFileSize(uri);
    if (size > 20 * 1024 * 1024) {
      Alert.alert('File Too Large', 'Maximum allowed size is 20MB.');
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const isPdf = uri.toLowerCase().endsWith('.pdf');
      const uuid = Crypto.randomUUID();

      let finalUrls: { original: string; thumbnail?: string };

      if (isPdf) {
        // Direct PDF upload (Receipts only)
        const path = `receipts/${id}/${uuid}.pdf`;
        const url = await mediaService.uploadFile(uri, path, (p) => setProgress(p.progress));
        finalUrls = { original: url };
      } else if (purpose === 'receipt') {
        // Image Processing for Receipts
        const processed = await imageProcessor.processReceipt(uri);
        const path = `receipts/${id}/${uuid}.jpg`;
        const url = await mediaService.uploadFile(processed.uri, path, (p) => setProgress(p.progress));
        finalUrls = { original: url };
      } else {
        // Image Processing for Profile/Group (Original + Thumb)
        const sizeLimit = purpose === 'profile' ? 512 : 800;
        const thumbLimit = purpose === 'profile' ? 128 : 160;

        const processed = await imageProcessor.processSquareImage(uri, {
          size: sizeLimit,
          thumbSize: thumbLimit,
        });

        const folder = purpose === 'profile' ? 'profile_photos' : 'group_photos';

        // Upload Original
        const originalUrl = await mediaService.uploadFile(
          processed.original.uri,
          `${folder}/${id}/${uuid}_original.jpg`,
          (p) => setProgress(p.progress * 0.8) // 80% of total bar
        );

        // Upload Thumbnail
        const thumbUrl = await mediaService.uploadFile(
          processed.thumbnail.uri,
          `${folder}/${id}/${uuid}_thumb.jpg`,
          (p) => setProgress(80 + (p.progress * 0.2)) // Remaining 20%
        );

        finalUrls = { original: originalUrl, thumbnail: thumbUrl };
      }

      // 3. Success Callback
      onSuccess(finalUrls);

      // 4. Cleanup Previous Assets (Async, non-blocking)
      if (previousUrls) {
        mediaService.deleteFile(previousUrls.original);
        mediaService.deleteFile(previousUrls.thumbnail);
      }

    } catch (error) {
      Alert.alert('Upload Failed', 'Something went wrong while uploading your media. Please try again.');
      console.error('MediaManager Error:', error);
    } finally {
      setIsUploading(false);
      setProgress(100);
    }
  };

  return {
    isUploading,
    progress,
    isPickerVisible,
    setIsPickerVisible,
    takePhoto,
    pickFromGallery,
    browseFiles,
  };
}
