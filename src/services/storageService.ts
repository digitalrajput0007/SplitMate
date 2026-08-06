import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * Uploads a file from a local URI to Firebase Storage.
 * @param uri The local URI of the file.
 * @param path The path in Firebase Storage (e.g., 'profile_photos/uid.jpg').
 * @returns The public download URL.
 */
export const uploadFileToStorage = async (uri: string, path: string): Promise<string> => {
  try {
    // 1. Convert URI to Blob (React Native specific approach)
    const response = await fetch(uri);
    const blob = await response.blob();

    // 2. Create a reference to the storage location
    const storageRef = ref(storage, path);

    // 3. Upload the blob
    await uploadBytes(storageRef, blob);

    // 4. Get and return the download URL
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error uploading file to Firebase Storage:', error);
    throw error;
  }
};

/**
 * Specifically handles profile photo uploads.
 */
export const uploadUserProfilePhoto = async (uid: string, uri: string): Promise<string> => {
  const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `profile_photos/${uid}_${Date.now()}.${extension}`;
  return await uploadFileToStorage(uri, path);
};

/**
 * Specifically handles group photo uploads.
 */
export const uploadGroupPhoto = async (groupId: string, uri: string): Promise<string> => {
  const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
  const path = `group_photos/${groupId}_${Date.now()}.${extension}`;
  return await uploadFileToStorage(uri, path);
};
