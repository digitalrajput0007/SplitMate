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

/**
 * Core Media Service for SplitMate
 * Handles atomic uploads and deletions in Firebase Storage
 */
class MediaService {
  /**
   * Deletes a file from Firebase Storage given its full URL or path
   */
  async deleteFile(urlOrPath: string | undefined): Promise<void> {
    if (!urlOrPath || !urlOrPath.startsWith('http')) return;

    try {
      const fileRef = ref(storage, urlOrPath);
      await deleteObject(fileRef);
    } catch (error) {
      // Ignore if file doesn't exist, log other errors
      console.warn('MediaService: Delete failed (might not exist)', error);
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
   * Helper to extract file extension from URI
   */
  getExtension(uri: string): string {
    return uri.split('.').pop()?.split('?')[0] || 'jpg';
  }

  /**
   * Helper to check file size
   */
  async getFileSize(uri: string): Promise<number> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) return 0;
      return fileInfo.size;
    } catch {
      return 0;
    }
  }
}

export const mediaService = new MediaService();
