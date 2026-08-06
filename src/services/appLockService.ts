import * as Crypto from 'expo-crypto';
import { getPinHash, savePinHash } from './secureStorageService';

export const hashPin = async (pin: string) => {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin
  );
  return hash;
};

export const verifyPin = async (pin: string) => {
  const storedHash = await getPinHash();
  if (!storedHash) return false;
  const currentHash = await hashPin(pin);
  return storedHash === currentHash;
};

export const setPin = async (pin: string) => {
  const hash = await hashPin(pin);
  await savePinHash(hash);
};
