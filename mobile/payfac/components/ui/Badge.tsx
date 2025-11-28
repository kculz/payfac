// ============================================================================
// FILE: components/ui/Badge.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, radius, spacing } from '@/lib/constants';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  /** Badge text */
  children: string;
  /** Badge variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Container style */
  containerStyle?: ViewStyle;
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon,
  containerStyle,
}: BadgeProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          container: { backgroundColor: colors.success.DEFAULT },
          text: { color: colors.dark.text.primary },
        };
      case 'warning':
        return {
          container: { backgroundColor: colors.warning.DEFAULT },
          text: { color: colors.dark.text.primary },
        };
      case 'error':
        return {
          container: { backgroundColor: colors.error.DEFAULT },
          text: { color: colors.dark.text.primary },
        };
      case 'info':
        return {
          container: { backgroundColor: colors.info.DEFAULT },
          text: { color: colors.dark.text.primary },
        };
      case 'default':
      default:
        return {
          container: { backgroundColor: colors.dark.border },
          text: { color: colors.dark.text.primary },
        };
    }
  };

  const variantStyles = getVariantStyles();

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingHorizontal: spacing[2],
            paddingVertical: spacing[1],
          },
          text: {
            fontSize: typography.fontSize.xs,
          },
        };
      case 'md':
      default:
        return {
          container: {
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1],
          },
          text: {
            fontSize: typography.fontSize.sm,
          },
        };
    }
  };

  const sizeStyles = getSizeStyles();

  const containerStyles: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    ...variantStyles.container,
    ...sizeStyles.container,
  };

  const textStyles: TextStyle = {
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.medium,
    ...variantStyles.text,
    ...sizeStyles.text,
  };

  return (
    <View style={[containerStyles, containerStyle]}>
      {icon && <View style={{ marginRight: spacing[1] }}>{icon}</View>}
      <Text style={textStyles}>{children}</Text>
    </View>
  );
}