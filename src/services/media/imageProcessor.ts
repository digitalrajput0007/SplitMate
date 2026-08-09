import * as ImageManipulator from 'expo-image-manipulator';

export interface ProcessedMedia {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType: string;
}

export interface DualLayerMedia {
  original: ProcessedMedia;
  thumbnail: ProcessedMedia;
}

/**
 * Image Processor for SplitMate
 * Resizes and compresses images before Firebase storage upload.
 */
class ImageProcessor {
  /**
   * Standardized Sizing Profiles
   */
  readonly PROFILES = {
    PROFILE_AVATAR: { size: 512, thumbSize: 128 },
    GROUP_HERO: { size: 800, thumbSize: 160 },
    RECEIPT: { maxDimension: 1200 }
  };

  /**
   * Compress and crop a square image with Dual-Layer (Original + Thumbnail)
   */
  async processSquareImage(
    uri: string,
    type: 'profile' | 'group'
  ): Promise<DualLayerMedia> {
    const config = type === 'profile' ? this.PROFILES.PROFILE_AVATAR : this.PROFILES.GROUP_HERO;

    try {
      // 1. Process Main Image (Optimized high-res)
      const originalResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: config.size, height: config.size } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 2. Process Lightweight Thumbnail (Low-res preview)
      const thumbResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: config.thumbSize, height: config.thumbSize } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );

      return {
        original: {
          uri: originalResult.uri,
          width: originalResult.width,
          height: originalResult.height,
          mimeType: 'image/jpeg'
        },
        thumbnail: {
          uri: thumbResult.uri,
          width: thumbResult.width,
          height: thumbResult.height,
          mimeType: 'image/jpeg'
        }
      };
    } catch (error) {
      console.warn('[ImageProcessor] Compression failed, fallback to original:', error);
      const fallbackMedia = { uri, width: config.size, height: config.size, mimeType: 'image/jpeg' };
      return { original: fallbackMedia, thumbnail: fallbackMedia };
    }
  }

  /**
   * Process and compress an expense receipt image
   */
  async processReceipt(uri: string): Promise<ProcessedMedia> {
    const { maxDimension } = this.PROFILES.RECEIPT;
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: maxDimension } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        mimeType: 'image/jpeg'
      };
    } catch (error) {
      console.warn('[ImageProcessor] Receipt compression fallback:', error);
      return { uri, width: maxDimension, height: maxDimension, mimeType: 'image/jpeg' };
    }
  }
}

export const imageProcessor = new ImageProcessor();
