import { AppShell } from '@/components/AppShell';
import { Text } from '@/components/ui/text';
import { useRouteDraft } from '@/features/route/RouteProvider';
import { Redirect } from 'expo-router';
import type { ReactElement } from 'react';
import { View } from 'react-native';
export default function InstructionsRoute(): ReactElement {
  const { ready, draft } = useRouteDraft();
  if (ready && draft.stops.length === 0) return <Redirect href="/" />;
  return (
    <AppShell active="instructions">
      <View style={{ flex: 1, padding: 16 }}>
        <Text>
          {ready
            ? 'Your selected stops are ready for delivery instructions.'
            : 'Restoring your saved route…'}
        </Text>
      </View>
    </AppShell>
  );
}
