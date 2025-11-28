// ============================================================================
// FILE: components/ui/Alert.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, radius, spacing } from '@/lib/constants';

type AlertVariant = 'success' | 'warning' | 'error' | 'info';

interface AlertProps {
  /** Alert title */
  title?: string;
  /** Alert description */
  description: string;
  /** Alert variant */
  variant?: AlertVariant;
  /** Whether alert can be dismissed */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Container style */
  containerStyle?: ViewStyle;
}

export function Alert({
  title,
  description,
  variant = 'info',
  dismissible = false,
  onDismiss,
  icon,
  containerStyle,
}: AlertProps) {
  const getVariantStyles = () => {
    const baseStyles = {
      container: {
        backgroundColor: colors.dark.surface,
        borderLeftWidth: 4,
        padding: spacing[4],
        borderRadius: radius.md,
      } as ViewStyle,
      text: {} as TextStyle,
    };

    switch (variant) {
      case 'success':
        return {
          container: {
            ...baseStyles.container,
            borderLeftColor: colors.success.DEFAULT,
            backgroundColor: colors.success.DEFAULT + '20',
          },
          text: { color: colors.success.light },
        };
      case 'warning':
        return {
          container: {
            ...baseStyles.container,
            borderLeftColor: colors.warning.DEFAULT,
            backgroundColor: colors.warning.DEFAULT + '20',
          },
          text: { color: colors.warning.light },
        };
      case 'error':
        return {
          container: {
            ...baseStyles.container,
            borderLeftColor: colors.error.DEFAULT,
            backgroundColor: colors.error.DEFAULT + '20',
          },
          text: { color: colors.error.light },
        };
      case 'info':
      default:
        return {
          container: {
            ...baseStyles.container,
            borderLeftColor: colors.info.DEFAULT,
            backgroundColor: colors.info.DEFAULT + '20',
          },
          text: { color: colors.info.light },
        };
    }
  };

  const variantStyles = getVariantStyles();

  const titleStyles: TextStyle = {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text.primary,
    marginBottom: spacing[1],
  };

  const descriptionStyles: TextStyle = {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    color: colors.dark.text.secondary,
    lineHeight: typography.lineHeight.normal,
  };

  return (
    <View style={[variantStyles.container, containerStyle]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {icon && <View style={{ marginRight: spacing[2] }}>{icon}</View>}
        
        <View style={{ flex: 1 }}>
          {title && <Text style={titleStyles}>{title}</Text>}
          <Text style={descriptionStyles}>{description}</Text>
        </View>

        {dismissible && (
          <TouchableOpacity onPress={onDismiss} style={{ marginLeft: spacing[2] }}>
            <Text style={{ color: colors.dark.text.tertiary, fontSize: 18 }}>×</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}