import { AppShell } from '@/components/AppShell';
import { Text } from '@/components/ui/text';
import type { ReactElement } from 'react';
import { View } from 'react-native';

export default function InstructionsRoute(): ReactElement {
  return (
    <AppShell active="instructions">
      <View className="flex-1 p-4">
        <Text>Select a stop on the Stops screen to add instructions.</Text>
      </View>
    </AppShell>
  );
}
