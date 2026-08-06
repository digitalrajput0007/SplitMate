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
 * Image Processor for SplitMate (Standard Version)
 * Handles basic pass-through when native manipulators are unavailable.
 * Removed dynamic requires to prevent bundler confusion.
 */
class ImageProcessor {
  /**
   * Standardized Sizing Profiles
   */
  readonly PROFILES = {
    PROFILE_AVATAR: { size: 512, thumbSize: 128 },
    GROUP_HERO: { size: 800, thumbSize: 160 },
    RECEIPT: { maxDimension: 1600 }
  };

  /**
   * Processes a square image with Dual-Layer (Original + Thumbnail)
   * Currently just a pass-through since expo-image-manipulator is uninstalled.
   */
  async processSquareImage(
    uri: string,
    type: 'profile' | 'group'
  ): Promise<DualLayerMedia> {
    const config = type === 'profile' ? this.PROFILES.PROFILE_AVATAR : this.PROFILES.GROUP_HERO;

    // Pass through since native code is missing
    const media = { uri, width: config.size, height: config.size, mimeType: 'image/jpeg' };
    return { original: media, thumbnail: media };
  }

  /**
   * Processes an expense receipt
   */
  async processReceipt(uri: string): Promise<ProcessedMedia> {
    const { maxDimension } = this.PROFILES.RECEIPT;
    return { uri, width: maxDimension, height: maxDimension, mimeType: 'image/jpeg' };
  }
}

export const imageProcessor = new ImageProcessor();
