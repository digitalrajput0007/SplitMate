import * as LocalAuthentication from 'expo-local-authentication';

export const checkBiometricHardware = async () => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  return hasHardware;
};

export const checkBiometricEnrolled = async () => {
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return isEnrolled;
};

export const authenticateBiometric = async (promptMessage: string = 'Authenticate to unlock') => {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: true, // We will use our own PIN pad
  });
  return result;
};

export const getSupportedBiometryTypes = async () => {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return types;
};
