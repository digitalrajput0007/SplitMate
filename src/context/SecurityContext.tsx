import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getLockSettings, saveLockSettings, LockSettings, defaultLockSettings } from '../services/secureStorageService';

interface SecurityContextType {
  isUnlocked: boolean;
  setIsUnlocked: (unlocked: boolean) => void;
  lockSettings: LockSettings;
  updateLockSettings: (settings: LockSettings) => Promise<void>;
  isLoading: boolean;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [lockSettings, setLockSettings] = useState<LockSettings>(defaultLockSettings);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  const backgroundTimestamp = useRef<number | null>(null);

  const loadSettings = async () => {
    try {
      const settings = await getLockSettings();
      setLockSettings(settings);
      // If app lock is not enabled at all, it's considered "unlocked" by default
      if (!settings.isBiometricEnabled && !settings.isPinEnabled) {
        setIsUnlocked(true);
      } else {
        setIsUnlocked(false);
      }
    } catch (e) {
      console.error('Failed to load lock settings', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/active/) &&
      (nextAppState === 'background' || nextAppState === 'inactive')
    ) {
      // App went to background
      backgroundTimestamp.current = Date.now();
    }

    if (
      appState.current.match(/background|inactive/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground
      if (backgroundTimestamp.current && (lockSettings.isPinEnabled || lockSettings.isBiometricEnabled)) {
        const elapsed = (Date.now() - backgroundTimestamp.current) / 1000;
        if (elapsed > lockSettings.lockTimeout) {
          setIsUnlocked(false);
        }
      }
      backgroundTimestamp.current = null;
    }

    appState.current = nextAppState;
  };

  const updateLockSettings = async (settings: LockSettings) => {
    await saveLockSettings(settings);
    setLockSettings(settings);

    // If we just disabled everything, unlock the app
    if (!settings.isBiometricEnabled && !settings.isPinEnabled) {
      setIsUnlocked(true);
    }
  };

  return (
    <SecurityContext.Provider value={{ isUnlocked, setIsUnlocked, lockSettings, updateLockSettings, isLoading }}>
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}
