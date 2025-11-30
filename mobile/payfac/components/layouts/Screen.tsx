// components/layout/Screen.tsx
import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ViewStyle,
  ScrollViewProps,
  KeyboardAvoidingViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, dimensions } from '@/lib/constants';

interface ScreenProps {
  /** Screen content */
  children: React.ReactNode;
  /** Whether to enable scrolling */
  scrollable?: boolean;
  /** Whether to avoid keyboard */
  avoidKeyboard?: boolean;
  /** Keyboard vertical offset (for KeyboardAvoidingView) */
  keyboardVerticalOffset?: number;
  /** Background color */
  backgroundColor?: string;
  /** Status bar style */
  statusBarStyle?: 'default' | 'light-content' | 'dark-content';
  /** Status bar background color (Android) */
  statusBarBackground?: string;
  /** Whether to show status bar */
  statusBarHidden?: boolean;
  /** Padding around the content */
  padding?: keyof typeof spacing;
  /** Horizontal padding */
  paddingHorizontal?: keyof typeof spacing;
  /** Vertical padding */
  paddingVertical?: keyof typeof spacing;
  /** Custom style */
  style?: ViewStyle;
  /** ScrollView props (if scrollable) */
  scrollViewProps?: ScrollViewProps;
  /** KeyboardAvoidingView props (if avoidKeyboard) */
  keyboardAvoidingProps?: KeyboardAvoidingViewProps;
  /** Additional className for NativeWind */
  className?: string;
}

export function Screen({
  children,
  scrollable = false,
  avoidKeyboard = false,
  keyboardVerticalOffset = 0,
  backgroundColor = colors.dark.bg,
  statusBarStyle = 'light-content',
  statusBarBackground = colors.dark.bg,
  statusBarHidden = false,
  padding = 4, // spacing[4] = 16
  paddingHorizontal,
  paddingVertical,
  style,
  scrollViewProps,
  keyboardAvoidingProps,
  className,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  // Calculate padding
  const horizontalPadding = paddingHorizontal ? spacing[paddingHorizontal] : spacing[padding];
  const verticalPadding = paddingVertical ? spacing[paddingVertical] : spacing[padding];

  // Base container style with safe area insets
  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
    paddingTop: insets.top + verticalPadding,
    paddingBottom: insets.bottom + verticalPadding,
    paddingLeft: insets.left + horizontalPadding,
    paddingRight: insets.right + horizontalPadding,
  };

  // Content container style for ScrollView
  const contentContainerStyle: ViewStyle = {
    flexGrow: 1,
  };

  // Render content based on props
  const renderContent = () => {
    if (scrollable) {
      return (
        <ScrollView
          style={containerStyle}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      );
    }

    return (
      <View style={[containerStyle, style]} className={className}>
        {children}
      </View>
    );
  };

  // Wrap with KeyboardAvoidingView if needed
  const renderWithKeyboardAvoidance = () => {
    if (avoidKeyboard && Platform.OS !== 'android') {
      return (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}
          {...keyboardAvoidingProps}
        >
          {renderContent()}
        </KeyboardAvoidingView>
      );
    }

    return renderContent();
  };

  return (
    <>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={statusBarBackground}
        hidden={statusBarHidden}
        translucent={false}
      />
      {renderWithKeyboardAvoidance()}
    </>
  );
}

// Pre-configured screen variants for common use cases
export function AuthScreen({ children, ...props }: Omit<ScreenProps, 'padding' | 'backgroundColor'>) {
  return (
    <Screen
      backgroundColor={colors.dark.bg}
      padding={6}
      avoidKeyboard
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      {...props}
    >
      {children}
    </Screen>
  );
}

export function DashboardScreen({ children, ...props }: Omit<ScreenProps, 'padding' | 'scrollable'>) {
  return (
    <Screen
      backgroundColor={colors.dark.bg}
      padding={4}
      scrollable
      {...props}
    >
      {children}
    </Screen>
  );
}

export function ModalScreen({ children, ...props }: Omit<ScreenProps, 'padding' | 'backgroundColor'>) {
  return (
    <Screen
      backgroundColor={colors.overlay.darker}
      padding={6}
      {...props}
    >
      {children}
    </Screen>
  );
}

export function FullScreen({ children, ...props }: Omit<ScreenProps, 'padding'>) {
  return (
    <Screen
      backgroundColor={colors.dark.bg}
      padding={0}
      {...props}
    >
      {children}
    </Screen>
  );
}

export function TabScreen({ children, ...props }: Omit<ScreenProps, 'padding' | 'scrollable'>) {
  return (
    <Screen
      backgroundColor={colors.dark.bg}
      padding={4}
      scrollable
      {...props}
    >
      {children}
    </Screen>
  );
}

// Screen header component for consistent headers
interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
}

export function ScreenHeader({
  title,
  subtitle,
  leftAction,
  rightAction,
  backgroundColor = colors.dark.bg,
  style,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          backgroundColor,
          paddingTop: insets.top + spacing[4],
          paddingBottom: spacing[4],
          paddingHorizontal: spacing[4],
          borderBottomWidth: 1,
          borderBottomColor: colors.dark.border,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left Action */}
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          {leftAction}
        </View>

        {/* Title */}
        <View style={{ flex: 3, alignItems: 'center' }}>
          <Text
            variant="h2"
            align="center"
            style={{ marginBottom: subtitle ? spacing[1] : 0 }}
          >
            {title}
          </Text>
          {subtitle && (
            <Text variant="caption" color="secondary" align="center">
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right Action */}
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          {rightAction}
        </View>
      </View>
    </View>
  );
}

// Helper component for screen sections
interface ScreenSectionProps {
  children: React.ReactNode;
  padding?: keyof typeof spacing;
  backgroundColor?: string;
  style?: ViewStyle;
  className?: string;
}

export function ScreenSection({
  children,
  padding = 4,
  backgroundColor = 'transparent',
  style,
  className,
}: ScreenSectionProps) {
  return (
    <View
      style={[
        {
          backgroundColor,
          padding: spacing[padding],
        },
        style,
      ]}
      className={className}
    >
      {children}
    </View>
  );
}

// Import Text component if not already imported
import { Text } from '../ui/Text';