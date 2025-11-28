// ============================================================================
// FILE: components/ui/Avatar.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React from 'react';
import { View, Text, Image, ViewStyle, TextStyle, ImageStyle } from 'react-native';
import { colors, typography, radius } from '@/lib/constants';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  /** Image source */
  source?: { uri: string };
  /** Fallback text when no image */
  fallback: string;
  /** Size variant */
  size?: AvatarSize;
  /** Custom size */
  customSize?: number;
  /** Container style */
  containerStyle?: ViewStyle;
}

export function Avatar({
  source,
  fallback,
  size = 'md',
  customSize,
  containerStyle,
}: AvatarProps) {
  const getSize = () => {
    if (customSize) return customSize;
    
    switch (size) {
      case 'sm': return 32;
      case 'md': return 40;
      case 'lg': return 56;
      case 'xl': return 80;
      default: return 40;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm': return typography.fontSize.xs;
      case 'md': return typography.fontSize.sm;
      case 'lg': return typography.fontSize.base;
      case 'xl': return typography.fontSize.lg;
      default: return typography.fontSize.sm;
    }
  };

  const avatarSize = getSize();
  const fontSize = getFontSize();

  const containerStyles: ViewStyle = {
    width: avatarSize,
    height: avatarSize,
    borderRadius: radius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  const fallbackStyles: TextStyle = {
    fontFamily: typography.fontFamily.sans,
    fontSize,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text.primary,
  };

  const imageStyles: ImageStyle = {
    width: '100%',
    height: '100%',
  };

  return (
    <View style={[containerStyles, containerStyle]}>
      {source ? (
        <Image source={source} style={imageStyles} />
      ) : (
        <Text style={fallbackStyles}>
          {fallback.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}