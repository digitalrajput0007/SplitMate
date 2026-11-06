import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot
} from 'firebase/storage';
import { storage } from '../../config/firebase';
import * as FileSystem from 'expo-file-system';
import { captureError, addSentryBreadcrumb } from '../../config/sentry';

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
      // 1. Resolve URI and get blob using XMLHttpRequest (more robust for Android file:// and content://)
      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
          resolve(xhr.response);
        };
        xhr.onerror = function (e) {
          console.error('MediaService: Blob conversion failed', e);
          reject(new TypeError("Network request failed"));
        };
        xhr.responseType = "blob";
        xhr.open("GET", localUri, true);
        xhr.send(null);
      });

      console.log(`MediaService: Prepared blob for upload. Size: ${blob.size} bytes`);
      if (blob.size === 0) {
        const sizeError = new Error('Blob size is 0. Upload aborted.');
        captureError(sizeError, {
          tags: { location: 'mediaService', action: 'uploadFile' },
          extra: { storagePath, localUri, fileSize: 0 },
        });
        throw sizeError;
      }

      addSentryBreadcrumb('media', `Uploading file to ${storagePath}`, {
        storagePath,
        fileSize: blob.size,
      });

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
            captureError(error, {
              tags: { location: 'mediaService', action: 'uploadFileTask' },
              extra: { storagePath, fileSize: blob.size },
            });
            if ((blob as any).close) (blob as any).close();
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              console.log('MediaService: Upload successful. URL:', downloadURL);
              if ((blob as any).close) (blob as any).close();
              resolve(downloadURL);
            } catch (urlErr) {
              console.error('MediaService: Failed to get download URL', urlErr);
              captureError(urlErr, {
                tags: { location: 'mediaService', action: 'getDownloadURL' },
                extra: { storagePath },
              });
              reject(urlErr);
            }
          }
        );
      });
    } catch (error) {
      console.error('MediaService: Pipeline init failed', error);
      captureError(error, {
        tags: { location: 'mediaService', action: 'uploadFileInit' },
        extra: { storagePath, localUri },
      });
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
