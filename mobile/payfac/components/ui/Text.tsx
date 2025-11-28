// ============================================================================
// FILE: components/ui/Text.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { colors, typography, TypographyStyle } from '@/lib/constants';

type TextVariant = TypographyStyle;
type TextColor = 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'error' | 'success' | 'warning';

interface TextProps extends RNTextProps {
  /** Typography variant */
  variant?: TextVariant;
  /** Text color */
  color?: TextColor;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Bold text */
  bold?: boolean;
  /** Semibold text */
  semibold?: boolean;
  /** Medium weight text */
  medium?: boolean;
  /** Italic text */
  italic?: boolean;
  /** Monospace font */
  mono?: boolean;
  /** Number of lines before truncation */
  numberOfLines?: number;
  /** Custom style */
  style?: TextStyle;
  /** Text content */
  children: React.ReactNode;
}

export function Text({
  variant = 'body',
  color = 'primary',
  align = 'left',
  bold,
  semibold,
  medium,
  italic,
  mono,
  numberOfLines,
  style,
  children,
  ...props
}: TextProps) {
  const getTextStyle = (): TextStyle => {
    // Base style from variant
    const baseStyle = typography.styles[variant];

    // Color mapping
    const colorMap: Record<TextColor, string> = {
      primary: colors.dark.text.primary,
      secondary: colors.dark.text.secondary,
      tertiary: colors.dark.text.tertiary,
      disabled: colors.dark.text.disabled,
      error: colors.error.DEFAULT,
      success: colors.success.DEFAULT,
      warning: colors.warning.DEFAULT,
    };

    // Font family
    const fontFamily = mono ? typography.fontFamily.mono : typography.fontFamily.sans;

    // Font weight
    let fontWeight = baseStyle.fontWeight;
    if (bold) fontWeight = typography.fontWeight.bold;
    else if (semibold) fontWeight = typography.fontWeight.semibold;
    else if (medium) fontWeight = typography.fontWeight.medium;

    return {
      fontFamily,
      fontSize: baseStyle.fontSize,
      lineHeight: baseStyle.fontSize * baseStyle.lineHeight,
      fontWeight,
      color: colorMap[color],
      textAlign: align,
      ...(italic && { fontStyle: 'italic' as const }),
    };
  };

  return (
    <RNText
      style={[getTextStyle(), style]}
      numberOfLines={numberOfLines}
      {...props}
    >
      {children}
    </RNText>
  );
}
