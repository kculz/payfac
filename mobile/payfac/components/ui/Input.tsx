// ============================================================================
// FILE: components/ui/Input.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, radius, dimensions, spacing } from '@/lib/constants';

interface InputProps extends TextInputProps {
  /** Input label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Icon on the left */
  leftIcon?: React.ReactNode;
  /** Icon on the right */
  rightIcon?: React.ReactNode;
  /** Container style */
  containerStyle?: ViewStyle;
  /** Input style */
  inputStyle?: TextStyle;
  /** Show password toggle (for password inputs) */
  showPasswordToggle?: boolean;
  /** Success state */
  success?: boolean;
  /** Required field indicator */
  required?: boolean;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  showPasswordToggle,
  success,
  required,
  secureTextEntry,
  editable = true,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const hasError = !!error;
  const isDisabled = !editable;

  // Container border color based on state
  const getBorderColor = () => {
    if (hasError) return colors.error.DEFAULT;
    if (success) return colors.success.DEFAULT;
    if (isFocused) return colors.primary[500];
    return colors.dark.border;
  };

  const containerStyles: ViewStyle = {
    marginBottom: spacing[4],
  };

  const inputContainerStyles: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    height: dimensions.input.md,
    backgroundColor: colors.dark.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: getBorderColor(),
    paddingHorizontal: spacing[4],
    ...(isDisabled && { opacity: 0.5 }),
  };

  const inputStyles: TextStyle = {
    flex: 1,
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.dark.text.primary,
    paddingHorizontal: leftIcon ? spacing[2] : 0,
  };

  const labelStyles: TextStyle = {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.dark.text.primary,
    marginBottom: spacing[2],
  };

  const helperTextStyles: TextStyle = {
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.xs,
    color: hasError 
      ? colors.error.DEFAULT 
      : success 
      ? colors.success.DEFAULT 
      : colors.dark.text.secondary,
    marginTop: spacing[1],
  };

  return (
    <View style={[containerStyles, containerStyle]}>
      {/* Label */}
      {label && (
        <Text style={labelStyles}>
          {label}
          {required && <Text style={{ color: colors.error.DEFAULT }}> *</Text>}
        </Text>
      )}

      {/* Input Container */}
      <View style={inputContainerStyles}>
        {/* Left Icon */}
        {leftIcon && <View style={{ marginRight: spacing[2] }}>{leftIcon}</View>}

        {/* Text Input */}
        <TextInput
          style={[inputStyles, inputStyle]}
          placeholderTextColor={colors.dark.text.tertiary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={editable}
          secureTextEntry={showPasswordToggle ? !isPasswordVisible : secureTextEntry}
          {...props}
        />

        {/* Password Toggle */}
        {showPasswordToggle && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={{ marginLeft: spacing[2] }}
          >
            <Text style={{ color: colors.dark.text.secondary }}>
              {isPasswordVisible ? '👁️' : '👁️‍🗨️'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Right Icon */}
        {rightIcon && <View style={{ marginLeft: spacing[2] }}>{rightIcon}</View>}
      </View>

      {/* Helper Text / Error */}
      {(helperText || error) && (
        <Text style={helperTextStyles}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
}