// Defensive import for expo-image-manipulator
let ImageManipulator: any = null;
try {
  ImageManipulator = require('expo-image-manipulator');
} catch (e) {
  console.warn('ImageProcessor: expo-image-manipulator not found');
}

export interface ProcessedMedia {
  uri: string;
  width: number;
  height: number;
  size?: number;
}

/**
 * Image Processor for SplitMate
 * Handles resizing, cropping, and compression before upload
 */
class ImageProcessor {
  /**
   * Processes an image for Profile or Group photo (Square Crop + Resize + Thumb)
   */
  async processSquareImage(
    uri: string,
    options: { size: number; thumbSize: number; quality?: number }
  ): Promise<{ original: ProcessedMedia; thumbnail: ProcessedMedia }> {
    // If manipulator is missing, return the original URI as both
    if (!ImageManipulator) {
      const fallback = { uri, width: options.size, height: options.size };
      return { original: fallback, thumbnail: fallback };
    }

    try {
      // 1. First pass: Resize to main size
      const original = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: options.size, height: options.size } }],
        { compress: options.quality || 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 2. Second pass: Resize for Thumbnail
      const thumbnail = await ImageManipulator.manipulateAsync(
        original.uri,
        [{ resize: { width: options.thumbSize, height: options.thumbSize } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      return {
        original: { uri: original.uri, width: original.width, height: original.height },
        thumbnail: { uri: thumbnail.uri, width: thumbnail.width, height: thumbnail.height },
      };
    } catch (error) {
      console.error('ImageProcessor: Square processing failed', error);
      const fallback = { uri, width: options.size, height: options.size };
      return { original: fallback, thumbnail: fallback };
    }
  }

  /**
   * Processes an expense receipt (Long side limit + Compression)
   */
  async processReceipt(
    uri: string,
    maxDimension: number = 1600
  ): Promise<ProcessedMedia> {
    if (!ImageManipulator) {
      return { uri, width: maxDimension, height: maxDimension };
    }

    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: maxDimension } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      console.error('ImageProcessor: Receipt processing failed', error);
      return { uri, width: maxDimension, height: maxDimension };
    }
  }
}

export const imageProcessor = new ImageProcessor();
