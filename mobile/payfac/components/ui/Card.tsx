// ============================================================================
// FILE: components/ui/Card.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React from 'react';
import { View, ViewStyle, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { colors, radius, dimensions, spacing } from '@/lib/constants';

type CardVariant = 'default' | 'outlined' | 'elevated';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface BaseCardProps {
  /** Card content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: CardVariant;
  /** Padding size */
  padding?: CardPadding;
  /** Custom style */
  style?: ViewStyle;
}

interface CardProps extends BaseCardProps {
  /** Make card pressable */
  onPress?: never;
}

interface PressableCardProps extends BaseCardProps, Omit<TouchableOpacityProps, 'style' | 'children'> {
  /** Press handler */
  onPress: () => void;
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  style,
  onPress,
  ...props
}: CardProps | PressableCardProps) {
  const getCardStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: radius.lg,
      overflow: 'hidden',
    };

    // Padding styles
    const paddingStyles: Record<CardPadding, ViewStyle> = {
      none: { padding: 0 },
      sm: { padding: dimensions.card.sm },
      md: { padding: dimensions.card.md },
      lg: { padding: dimensions.card.lg },
    };

    // Variant styles
    const variantStyles: Record<CardVariant, ViewStyle> = {
      default: {
        backgroundColor: colors.dark.surface,
      },
      outlined: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.dark.border,
      },
      elevated: {
        backgroundColor: colors.dark.surface,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
      },
    };

    return {
      ...baseStyle,
      ...variantStyles[variant],
      ...paddingStyles[padding],
    };
  };

  // If onPress is provided, render as TouchableOpacity
  if (onPress) {
    return (
      <TouchableOpacity
        style={[getCardStyle(), style]}
        activeOpacity={0.7}
        onPress={onPress}
        {...(props as TouchableOpacityProps)}
      >
        {children}
      </TouchableOpacity>
    );
  }

  // Otherwise, render as View
  return (
    <View style={[getCardStyle(), style]}>
      {children}
    </View>
  );
}