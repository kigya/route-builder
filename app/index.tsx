import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { ReactElement } from 'react';
import { View } from 'react-native';

export default function StopsRoute(): ReactElement {
  return (
    <AppShell active="stops">
      <View className="flex-1 gap-4 px-4 pt-4">
        <Input
          accessibilityLabel="Search stops"
          placeholder="Search by name, street, or phone"
          editable={false}
        />
        <Card>
          <CardContent>
            <Text>Select delivery stops to start your route.</Text>
          </CardContent>
        </Card>
      </View>
      <View className="px-4 pb-4 pt-3">
        <Button disabled accessibilityLabel="Continue" className="h-12 rounded-xl">
          <Text>Continue</Text>
        </Button>
      </View>
    </AppShell>
  );
}
