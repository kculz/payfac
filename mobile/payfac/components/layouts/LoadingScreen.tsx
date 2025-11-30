// components/layout/LoadingScreen.tsx
import React from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { colors, spacing, typography, radius } from '../../lib/constants';
import { Skeleton } from '../ui/Skeleton';

interface LoadingScreenProps {
  /** Optional title to display */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Whether to show skeleton placeholders */
  showSkeletons?: boolean;
  /** Type of loading screen */
  variant?: 'full' | 'content' | 'overlay';
}

export function LoadingScreen({
  title = 'Loading...',
  subtitle = 'Please wait while we get things ready',
  showSkeletons = false,
  variant = 'full',
}: LoadingScreenProps) {
  const spinValue = new Animated.Value(0);

  // Animation for the spinner
  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Full screen loading
  if (variant === 'full') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.dark.bg,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing[6],
        }}
      >
        {/* Spinner */}
        <Animated.View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.full,
            borderWidth: 3,
            borderColor: colors.primary[500] + '20',
            borderTopColor: colors.primary[500],
            transform: [{ rotate: spin }],
            marginBottom: spacing[6],
          }}
        />

        {/* Title */}
        <Text
          style={{
            fontSize: typography.fontSize['2xl'],
            fontWeight: typography.fontWeight.semibold,
            color: colors.dark.text.primary,
            textAlign: 'center',
            marginBottom: spacing[2],
          }}
        >
          {title}
        </Text>

        {/* Subtitle */}
        <Text
          style={{
            fontSize: typography.fontSize.base,
            fontWeight: typography.fontWeight.normal,
            color: colors.dark.text.secondary,
            textAlign: 'center',
            lineHeight: typography.lineHeight.normal,
          }}
        >
          {subtitle}
        </Text>

        {/* Optional skeleton placeholders */}
        {showSkeletons && (
          <View style={{ marginTop: spacing[8], width: '100%', gap: spacing[4] }}>
            <Skeleton width="100%" height={80} borderRadius={radius.lg} />
            <Skeleton width="100%" height={120} borderRadius={radius.lg} />
            <Skeleton width="100%" height={60} borderRadius={radius.lg} />
          </View>
        )}
      </View>
    );
  }

  // Content loading (for sections)
  if (variant === 'content') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.dark.bg,
          padding: spacing[6],
        }}
      >
        {/* Header skeleton */}
        <View style={{ marginBottom: spacing[6] }}>
          <Skeleton width={200} height={32} borderRadius={radius.md} style={{ marginBottom: spacing[2] }} />
          <Skeleton width={280} height={20} borderRadius={radius.md} />
        </View>

        {/* Content skeletons */}
        <View style={{ gap: spacing[4] }}>
          <Skeleton width="100%" height={120} borderRadius={radius.lg} />
          <Skeleton width="100%" height={80} borderRadius={radius.lg} />
          <Skeleton width="100%" height={80} borderRadius={radius.lg} />
          <Skeleton width="100%" height={80} borderRadius={radius.lg} />
        </View>
      </View>
    );
  }

  // Overlay loading (for modals, etc.)
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.overlay.darker,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing[6],
      }}
    >
      <View
        style={{
          backgroundColor: colors.dark.surface,
          padding: spacing[6],
          borderRadius: radius.xl,
          alignItems: 'center',
          minWidth: 200,
        }}
      >
        {/* Spinner */}
        <Animated.View
          style={{
            width: 48,
            height: 48,
            borderRadius: radius.full,
            borderWidth: 2,
            borderColor: colors.primary[500] + '20',
            borderTopColor: colors.primary[500],
            transform: [{ rotate: spin }],
            marginBottom: spacing[4],
          }}
        />

        {/* Title */}
        <Text
          style={{
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.dark.text.primary,
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
      </View>
    </View>
  );
}

// Quick loading components for common use cases
export function AuthLoadingScreen() {
  return (
    <LoadingScreen
      title="Securing your account"
      subtitle="We're verifying your credentials"
      variant="full"
    />
  );
}

export function DashboardLoadingScreen() {
  return (
    <LoadingScreen
      title="Loading dashboard"
      subtitle="Fetching your latest data"
      showSkeletons={true}
      variant="full"
    />
  );
}

export function ContentLoading() {
  return <LoadingScreen variant="content" />;
}

export function OverlayLoading() {
  return (
    <LoadingScreen
      title="Processing..."
      variant="overlay"
    />
  );
}

// Loading states for specific components
export function BalanceCardLoading() {
  return (
    <View
      style={{
        backgroundColor: colors.dark.surface,
        padding: spacing[6],
        borderRadius: radius.xl,
        gap: spacing[4],
      }}
    >
      <Skeleton width={120} height={20} borderRadius={radius.md} />
      <Skeleton width={180} height={32} borderRadius={radius.md} />
      <View style={{ flexDirection: 'row', gap: spacing[4] }}>
        <Skeleton width={80} height={16} borderRadius={radius.md} />
        <Skeleton width={80} height={16} borderRadius={radius.md} />
      </View>
    </View>
  );
}

export function TransactionListLoading() {
  return (
    <View style={{ gap: spacing[3] }}>
      {[1, 2, 3, 4, 5].map((item) => (
        <View
          key={item}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing[4],
            backgroundColor: colors.dark.surface,
            borderRadius: radius.lg,
            gap: spacing[4],
          }}
        >
          <Skeleton width={40} height={40} borderRadius={radius.full} />
          <View style={{ flex: 1, gap: spacing[1] }}>
            <Skeleton width="60%" height={16} borderRadius={radius.md} />
            <Skeleton width="40%" height={14} borderRadius={radius.md} />
          </View>
          <Skeleton width={80} height={20} borderRadius={radius.md} />
        </View>
      ))}
    </View>
  );
}

export function QuickActionsLoading() {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', gap: spacing[4] }}>
      {[1, 2, 3, 4].map((item) => (
        <View key={item} style={{ alignItems: 'center', gap: spacing[2] }}>
          <Skeleton width={56} height={56} borderRadius={radius.lg} />
          <Skeleton width={60} height={14} borderRadius={radius.md} />
        </View>
      ))}
    </View>
  );
}