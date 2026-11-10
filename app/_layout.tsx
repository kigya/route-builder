import '../global.css';
import { RouteProvider } from '@/features/route/RouteProvider';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactElement } from 'react';
import { I18nManager } from 'react-native';

I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

export { ErrorBoundary } from 'expo-router';
export default function RootLayout(): ReactElement {
  return (
    <RouteProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#EEF1F3' } }} />
      <PortalHost />
    </RouteProvider>
  );
}
