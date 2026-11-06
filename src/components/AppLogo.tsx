import React from 'react';
import { Image, View, StyleSheet } from 'react-native';

interface AppLogoProps {
  size?: number;
}

export default function AppLogo({ size = 48 }: AppLogoProps) {
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require('../../assets/icon.png')}
        style={{ width: '100%', height: '100%', borderRadius: size * 0.2 }}
        resizeMode="contain"
      />
    </View>
  );
}

