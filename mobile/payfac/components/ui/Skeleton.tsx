// ============================================================================
// FILE: components/ui/Skeleton.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';
import { colors, radius } from '@/lib/constants';

interface SkeletonProps {
  /** Width of skeleton */
  width?: number | string;
  /** Height of skeleton */
  height?: number | string;
  /** Border radius */
  borderRadius?: number;
  /** Custom style */
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = radius.md,
  style,
}: SkeletonProps) {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacityAnim]);

  const skeletonStyles = {
    width: typeof width === 'string' ? width : width,
    height: typeof height === 'string' ? undefined : height,
    borderRadius,
    backgroundColor: colors.dark.border,
  };

  return (
    <Animated.View
      style={[
        skeletonStyles as ViewStyle,
        style,
        { opacity: opacityAnim },
      ]}
    />
  );
}