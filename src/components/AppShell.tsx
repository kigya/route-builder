import { Text } from '@/components/ui/text';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouteDraft } from '@/features/route/RouteProvider';
import { colors } from '@/theme/tokens';
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type WorkflowStep = 'stops' | 'instructions';
type AppShellProps = { active: WorkflowStep; children: ReactNode };
export function useRouteNavigation(active: WorkflowStep): {
  canViewInstructions: boolean;
  openInstructions: () => void;
  openStops: () => void;
} {
  const { ready, draft } = useRouteDraft();
  const canViewInstructions = ready && draft.stops.length > 0;
  return {
    canViewInstructions,
    openInstructions() {
      if (active !== 'instructions' && canViewInstructions) router.navigate('/instructions');
    },
    openStops() {
      if (active !== 'stops') router.dismissTo('/');
    },
  };
}
export function AppShell({ active, children }: AppShellProps): ReactElement {
  const { draft } = useRouteDraft();
  const { canViewInstructions, openInstructions, openStops } = useRouteNavigation(active);
  const packages = draft.stops.reduce((total, entry) => total + entry.packages, 0);
  const stops = draft.stops.length;
  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: colors.card, direction: 'ltr' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 14,
          paddingVertical: 16,
        }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <MapPin size={26} color="white" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', lineHeight: 26 }}>Morning route</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }} accessibilityLiveRegion="polite">
            {packages} {packages === 1 ? 'package' : 'packages'} · {stops}{' '}
            {stops === 1 ? 'stop' : 'stops'}
          </Text>
        </View>
      </View>
      <Tabs
        value={active}
        onValueChange={(value) => {
          if (value === 'stops') openStops();
          else if (value === 'instructions') openInstructions();
        }}>
        <TabsList className="h-auto w-full flex-row rounded-none border-b border-border bg-white p-0">
          {(['stops', 'instructions'] as const).map((step) => (
            <TabsTrigger
              key={step}
              value={step}
              accessibilityLabel={step === 'stops' ? 'Stops' : 'Instructions'}
              disabled={step === 'instructions' && !canViewInstructions}
              className="flex-1 rounded-none border-0 bg-white px-2 py-3"
              style={{
                minHeight: 48,
                height: 'auto',
                borderBottomWidth: 3,
                borderBottomColor: active === step ? colors.primary : 'transparent',
                boxShadow: 'none',
              }}>
              <Text
                style={{
                  color: active === step ? colors.primary : colors.muted,
                  fontWeight: active === step ? '700' : '500',
                  fontSize: 15,
                }}>
                {step === 'stops' ? 'Stops' : 'Instructions'}
              </Text>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>
    </SafeAreaView>
  );
}
