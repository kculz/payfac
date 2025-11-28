// ============================================================================
// FILE: components/ui/SearchBar.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  TextInputProps,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, radius, spacing } from '@/lib/constants';

interface SearchBarProps extends TextInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Container style */
  containerStyle?: ViewStyle;
  /** Input style */
  inputStyle?: TextStyle;
  /** Callback when search text changes */
  onSearchChange?: (text: string) => void;
  /** Show clear button */
  showClearButton?: boolean;
}

export function SearchBar({
  placeholder = 'Search...',
  containerStyle,
  inputStyle,
  onSearchChange,
  showClearButton = true,
  value,
  ...props
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);

  const containerStyles: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: isFocused ? colors.primary[500] : colors.dark.border,
    paddingHorizontal: spacing[4],
    height: 44,
  };

  const inputStyles: TextStyle = {
    flex: 1,
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.base,
    color: colors.dark.text.primary,
    paddingVertical: spacing[2],
  };

  const clearButtonStyles: ViewStyle = {
    padding: spacing[1],
    marginLeft: spacing[2],
  };

  const handleClear = () => {
    if (onSearchChange) {
      onSearchChange('');
    }
  };

  return (
    <View style={[containerStyles, containerStyle]}>
      {/* Search Icon */}
      <Text style={{ color: colors.dark.text.tertiary, marginRight: spacing[2] }}>
        🔍
      </Text>

      {/* Text Input */}
      <TextInput
        style={[inputStyles, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={colors.dark.text.tertiary}
        value={value}
        onChangeText={onSearchChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        returnKeyType="search"
        {...props}
      />

      {/* Clear Button */}
      {showClearButton && value && (
        <TouchableOpacity onPress={handleClear} style={clearButtonStyles}>
          <Text style={{ color: colors.dark.text.tertiary, fontSize: 18 }}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}