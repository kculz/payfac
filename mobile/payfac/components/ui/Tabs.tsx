// ============================================================================
// FILE: components/ui/Tabs.tsx
// BRANCH: feature/ui-primitives
// ============================================================================

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, spacing } from '@/lib/constants';

interface Tab {
  /** Tab ID */
  id: string;
  /** Tab label */
  label: string;
  /** Tab content */
  content: React.ReactNode;
  /** Disabled state */
  disabled?: boolean;
}

interface TabsProps {
  /** Array of tabs */
  tabs: Tab[];
  /** Active tab ID */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (tabId: string) => void;
  /** Container style */
  containerStyle?: ViewStyle;
  /** Tab list style */
  tabListStyle?: ViewStyle;
  /** Tab content style */
  tabContentStyle?: ViewStyle;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  containerStyle,
  tabListStyle,
  tabContentStyle,
}: TabsProps) {
  const containerStyles: ViewStyle = {
    flex: 1,
  };

  const tabListStyles: ViewStyle = {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  };

  const tabStyles = (isActive: boolean, isDisabled?: boolean) => ({
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 2,
    borderBottomColor: isActive ? colors.primary[500] : 'transparent',
    opacity: isDisabled ? 0.5 : 1,
  });

  const tabTextStyles = (isActive: boolean, isDisabled?: boolean) => ({
    fontFamily: typography.fontFamily.sans,
    fontSize: typography.fontSize.sm,
    fontWeight: isActive ? typography.fontWeight.semibold : typography.fontWeight.medium,
    color: isActive ? colors.primary[500] : colors.dark.text.secondary,
  });

  const tabContentStyles: ViewStyle = {
    flex: 1,
    paddingVertical: spacing[4],
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <View style={[containerStyles, containerStyle]}>
      {/* Tab List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[tabListStyles, tabListStyle]}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            style={tabStyles(tab.id === activeTab, tab.disabled)}
          >
            <Text style={tabTextStyles(tab.id === activeTab, tab.disabled)}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab Content */}
      <View style={[tabContentStyles, tabContentStyle]}>
        {activeTabContent}
      </View>
    </View>
  );
}