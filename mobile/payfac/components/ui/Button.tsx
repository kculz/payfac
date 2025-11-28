// ============================================================================
// FILE: components/ui/Button.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, radius, dimensions } from '@/lib/constants';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  /** Button text */
  children: React.ReactNode;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size variant */
  size?: ButtonSize;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: TextStyle;
  /** Icon on the left */
  leftIcon?: React.ReactNode;
  /** Icon on the right */
  rightIcon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // Container styles based on variant
  const getContainerStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
    };

    // Size styles
    const sizeStyles: Record<ButtonSize, ViewStyle> = {
      sm: {
        height: dimensions.button.sm,
        paddingHorizontal: 16,
      },
      md: {
        height: dimensions.button.md,
        paddingHorizontal: 24,
      },
      lg: {
        height: dimensions.button.lg,
        paddingHorizontal: 32,
      },
    };

    // Variant styles
    const variantStyles: Record<ButtonVariant, ViewStyle> = {
      primary: {
        backgroundColor: colors.primary[600],
        borderColor: colors.primary[600],
      },
      secondary: {
        backgroundColor: colors.dark.surface,
        borderColor: colors.dark.border,
      },
      outline: {
        backgroundColor: 'transparent',
        borderColor: colors.primary[600],
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
      },
      danger: {
        backgroundColor: colors.error.DEFAULT,
        borderColor: colors.error.DEFAULT,
      },
    };

    // Disabled styles
    const disabledStyle: ViewStyle = {
      opacity: 0.5,
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...(fullWidth && { width: '100%' }),
      ...(isDisabled && disabledStyle),
    };
  };

  // Text styles based on variant and size
  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontFamily: typography.fontFamily.sans,
      fontWeight: typography.fontWeight.semibold,
    };

    // Size styles
    const sizeStyles: Record<ButtonSize, TextStyle> = {
      sm: {
        fontSize: typography.fontSize.sm,
      },
      md: {
        fontSize: typography.fontSize.base,
      },
      lg: {
        fontSize: typography.fontSize.lg,
      },
    };

    // Variant text colors
    const variantTextColors: Record<ButtonVariant, string> = {
      primary: colors.dark.text.primary,
      secondary: colors.dark.text.primary,
      outline: colors.primary[500],
      ghost: colors.primary[500],
      danger: colors.dark.text.primary,
    };

    return {
      ...baseStyle,
      ...sizeStyles[size],
      color: variantTextColors[variant],
    };
  };

  return (
    <TouchableOpacity
      style={[getContainerStyle(), style]}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' 
            ? colors.primary[500] 
            : colors.dark.text.primary
          }
          size="small"
        />
      ) : (
        <>
          {leftIcon && <>{leftIcon}</>}
          <Text style={[getTextStyle(), textStyle]}>
            {children}
          </Text>
          {rightIcon && <>{rightIcon}</>}
        </>
      )}
    </TouchableOpacity>
  );
}