// ============================================================================
// FILE: components/ui/EmptyState.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, spacing } from '@/lib/constants';

interface EmptyStateProps {
  /** Icon or illustration */
  icon?: React.ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Action button */
  action?: React.ReactNode;
  /** Container style */
  containerStyle?: ViewStyle;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  containerStyle,
}: EmptyStateProps) {
  const containerStyles: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[16],
    paddingHorizontal: spacing[8],
  };

  const titleStyles: TextStyle = {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text.primary,
    textAlign: 'center',
    marginTop: spacing[4],
    marginBottom: spacing[2],
  };

  const descriptionStyles: TextStyle = {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.dark.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.relaxed,
    marginBottom: spacing[6],
  };

  return (
    <View style={[containerStyles, containerStyle]}>
      {icon && <View>{icon}</View>}
      
      <Text style={titleStyles}>{title}</Text>
      
      {description && (
        <Text style={descriptionStyles}>{description}</Text>
      )}
      
      {action && <View>{action}</View>}
    </View>
  );
}