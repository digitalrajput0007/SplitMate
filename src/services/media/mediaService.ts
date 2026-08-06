import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot
} from 'firebase/storage';
import { storage } from '../../config/firebase';
import * as FileSystem from 'expo-file-system';

export interface UploadProgress {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface MediaMetadata {
  url: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  createdAt: number;
}

/**
 * Core Media Service for SplitMate Phase 2
 * Handles atomic uploads, metadata, and cleanup
 */
class MediaService {
  /**
   * Deletes a file from Firebase Storage given its full URL
   */
  async deleteFile(url: string | undefined): Promise<void> {
    if (!url || !url.startsWith('http')) return;

    try {
      const fileRef = ref(storage, url);
      await deleteObject(fileRef);
    } catch (error) {
      // Common error: file already deleted or doesn't exist
      console.warn('MediaService: Non-critical delete failure', error);
    }
  }

  /**
   * Uploads a local file to Firebase Storage with progress tracking
   */
  async uploadFile(
    localUri: string,
    storagePath: string,
    onProgress?: (p: UploadProgress) => void
  ): Promise<string> {
    try {
      // 1. Resolve URI and get blob
      const response = await fetch(localUri);
      const blob = await response.blob();

      // 2. Create reference
      const storageRef = ref(storage, storagePath);

      // 3. Start resumable upload
      const uploadTask = uploadBytesResumable(storageRef, blob);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot: UploadTaskSnapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            if (onProgress) {
              onProgress({
                progress,
                bytesTransferred: snapshot.bytesTransferred,
                totalBytes: snapshot.totalBytes,
              });
            }
          },
          (error) => {
            console.error('MediaService: Upload failed', error);
            if (blob.close) (blob as any).close();
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              if (blob.close) (blob as any).close();
              resolve(downloadURL);
            } catch (urlErr) {
              reject(urlErr);
            }
          }
        );
      });
    } catch (error) {
      console.error('MediaService: Pipeline init failed', error);
      throw error;
    }
  }

  /**
   * Utility: Get Info including size
   */
  async getInfo(uri: string): Promise<{ size: number; exists: boolean }> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return { size: info.exists ? info.size : 0, exists: info.exists };
    } catch {
      return { size: 0, exists: false };
    }
  }
}

export const mediaService = new MediaService();
