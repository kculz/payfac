// ============================================================================
// FILE: components/ui/Modal.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal as RNModal,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, radius, spacing } from '@/lib/constants';

interface ModalProps {
  /** Whether modal is visible */
  visible: boolean;
  /** Modal title */
  title?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Primary action button */
  primaryAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
  /** Close button callback */
  onClose: () => void;
  /** Show close button */
  showCloseButton?: boolean;
  /** Container style */
  containerStyle?: ViewStyle;
}

export function Modal({
  visible,
  title,
  children,
  primaryAction,
  secondaryAction,
  onClose,
  showCloseButton = true,
  containerStyle,
}: ModalProps) {
  const overlayStyles: ViewStyle = {
    flex: 1,
    backgroundColor: colors.overlay.darker,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  };

  const containerStyles: ViewStyle = {
    backgroundColor: colors.dark.surface,
    borderRadius: radius.xl,
    padding: spacing[6],
    width: '100%',
    maxWidth: 400,
  };

  const headerStyles: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  };

  const titleStyles: TextStyle = {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.dark.text.primary,
    flex: 1,
  };

  const closeButtonStyles: ViewStyle = {
    padding: spacing[1],
    marginLeft: spacing[2],
  };

  const footerStyles: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing[6],
    gap: spacing[3],
  };

  const buttonStyles = (variant: 'primary' | 'secondary') => ({
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: radius.md,
    backgroundColor: variant === 'primary' ? colors.primary[500] : 'transparent',
  });

  const buttonTextStyles = (variant: 'primary' | 'secondary') => ({
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: variant === 'primary' ? colors.dark.text.primary : colors.dark.text.secondary,
  });

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={overlayStyles}>
        <View style={[containerStyles, containerStyle]}>
          {/* Header */}
          {(title || showCloseButton) && (
            <View style={headerStyles}>
              {title && <Text style={titleStyles}>{title}</Text>}
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} style={closeButtonStyles}>
                  <Text style={{ color: colors.dark.text.tertiary, fontSize: 20 }}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content */}
          <View>{children}</View>

          {/* Footer */}
          {(primaryAction || secondaryAction) && (
            <View style={footerStyles}>
              {secondaryAction && (
                <TouchableOpacity
                  onPress={secondaryAction.onPress}
                  disabled={secondaryAction.disabled}
                  style={buttonStyles('secondary')}
                >
                  <Text style={buttonTextStyles('secondary')}>
                    {secondaryAction.label}
                  </Text>
                </TouchableOpacity>
              )}
              
              {primaryAction && (
                <TouchableOpacity
                  onPress={primaryAction.onPress}
                  disabled={primaryAction.disabled}
                  style={[
                    buttonStyles('primary'),
                    primaryAction.disabled && { opacity: 0.5 },
                  ]}
                >
                  <Text style={buttonTextStyles('primary')}>
                    {primaryAction.label}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </RNModal>
  );
}