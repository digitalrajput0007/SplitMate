import { ref, uploadBytesResumable, getDownloadURL, UploadTaskSnapshot } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Normalizes URIs from expo-image-picker to ensure they are compatible
 * with the native fetch() implementation.
 */
const normalizeUri = (uri: string): string => {
  if (!uri) return uri;
  // Handle double encoding issues common on Android (e.g. %2540 -> %)
  let normalized = uri.includes('%25') ? uri.replace(/%25/g, '%') : uri;
  // Ensure file:// prefix is present for local files if not already
  if (normalized.startsWith('/') && !normalized.startsWith('file://')) {
    normalized = `file://${normalized}`;
  }
  return normalized;
};

/**
 * Uploads a file from a local URI to Firebase Storage.
 * Uses the native fetch().blob() pipeline which is the most reliable
 * method for Expo/React Native as it streams data directly to native.
 *
 * @param uri The local URI of the file.
 * @param path The path in Firebase Storage.
 * @param onProgress Optional callback for upload progress (0-100).
 * @returns The public download URL.
 */
export const uploadFileToStorage = async (
  uri: string,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  let blob: Blob | null = null;

  try {
    const normalizedUri = normalizeUri(uri);

    // 1. Get Blob using native optimized fetch pipeline
    // In React Native, this invokes a C++ module that doesn't use JS memory
    const response = await fetch(normalizedUri);
    blob = await response.blob();

    // 2. Create Storage Reference
    const storageRef = ref(storage, path);

    // 3. Perform Resumable Upload
    // This is more robust on unstable mobile networks than simple uploadBytes
    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => {
          console.error('Firebase Storage Upload Task Error:', error);
          if (blob) (blob as any).close();
          reject(error);
        },
        async () => {
          // 4. Handle Success
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            // 5. Explicitly close the blob to free native memory
            if (blob) (blob as any).close();
            resolve(downloadURL);
          } catch (urlError) {
            reject(urlError);
          }
        }
      );
    });
  } catch (error) {
    console.error('Failed to initiate upload pipeline:', error);
    if (blob) (blob as any).close();
    throw error;
  }
};

/**
 * Specifically handles profile photo uploads.
 */
export const uploadUserProfilePhoto = async (uid: string, uri: string): Promise<string> => {
  const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `profile_photos/${uid}.${extension}`;
  return await uploadFileToStorage(uri, path);
};

/**
 * Specifically handles group photo uploads.
 */
export const uploadGroupPhoto = async (groupId: string, uri: string): Promise<string> => {
  const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `group_photos/${groupId}.${extension}`;
  return await uploadFileToStorage(uri, path);
};

/**
 * Specifically handles expense receipt uploads.
 */
export const uploadExpenseReceipt = async (expenseId: string, uri: string): Promise<string> => {
  const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `receipts/${expenseId}_${Date.now()}.${extension}`;
  return await uploadFileToStorage(uri, path);
};
