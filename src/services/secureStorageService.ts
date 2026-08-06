import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'app_lock_pin_hash';
const LOCK_SETTINGS_KEY = 'app_lock_settings';

export interface LockSettings {
  isBiometricEnabled: boolean;
  isPinEnabled: boolean;
  pinLength: 4 | 6;
  lockTimeout: number; // in seconds
}

export const defaultLockSettings: LockSettings = {
  isBiometricEnabled: false,
  isPinEnabled: false,
  pinLength: 4,
  lockTimeout: 30,
};

export const savePinHash = async (hash: string) => {
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
};

export const getPinHash = async () => {
  return await SecureStore.getItemAsync(PIN_HASH_KEY);
};

export const deletePinHash = async () => {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
};

export const saveLockSettings = async (settings: LockSettings) => {
  await SecureStore.setItemAsync(LOCK_SETTINGS_KEY, JSON.stringify(settings));
};

export const getLockSettings = async (): Promise<LockSettings> => {
  const settings = await SecureStore.getItemAsync(LOCK_SETTINGS_KEY);
  return settings ? JSON.parse(settings) : defaultLockSettings;
};
