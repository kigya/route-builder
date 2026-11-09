import { Text } from '@/components/ui/text';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { colors } from '@/theme/tokens';
import { router } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type AppShellProps = { active: 'stops' | 'instructions'; children: ReactNode };

export function AppShell({ active, children }: AppShellProps): ReactElement {
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: colors.background, direction: 'ltr' }}>
      <View className="flex-row items-center gap-3 px-4 py-4">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <Text
            className="text-2xl font-bold text-primary-foreground"
            accessibilityLabel="Route Builder">
            ↱
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-xl font-bold">Morning route</Text>
          <Text variant="muted">0 packages · 0 stops</Text>
        </View>
      </View>
      <Tabs
        value={active}
        onValueChange={(value) => {
          if (value === 'stops') router.replace('/');
        }}>
        <TabsList className="mx-4 h-12 w-auto flex-row rounded-none border-b border-border bg-transparent p-0">
          <TabsTrigger value="stops" className="h-12 flex-1 rounded-none border-0 bg-transparent">
            <Text
              className={
                active === 'stops' ? 'font-semibold text-primary' : 'text-muted-foreground'
              }>
              Stops
            </Text>
          </TabsTrigger>
          <TabsTrigger
            value="instructions"
            disabled
            className="h-12 flex-1 rounded-none border-0 bg-transparent"
            accessibilityLabel="Instructions, select a stop first">
            <Text className="text-muted-foreground">Instructions</Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {children}
    </SafeAreaView>
  );
}
