import React from 'react';
import { Image, StyleSheet } from 'react-native';

interface LogoNavProps {
  size?: number;
  color?: string;
}

export function LogoNav({ size = 28 }: LogoNavProps) {
  return (
    <Image
      source={require('@/assets/images/logo_fix.png')}
      style={{
        width: size,
        height: size,
      }}
      resizeMode="contain"
    />
  );
}
