import type { ReactElement } from 'react';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useRouteDraft } from '@/features/route/RouteProvider';
import { colors } from '@/theme/tokens';
import { ConfirmationDialog } from './confirmation-dialog';
export function DraftRecovery(): ReactElement | null {
  const route = useRouteDraft();
  const { status, storageError, saving, isSubmitting } = route;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  if (status === 'restoring')
    return (
      <View style={{ padding: 14, flexDirection: 'row', gap: 10 }}>
        <ActivityIndicator color={colors.primary} />
        <Text>Restoring your saved route…</Text>
      </View>
    );
  const needsRestore = status === 'recovery' || status === 'restore-error';
  if (!needsRestore && !storageError) return null;
  return (
    <View
      style={{
        padding: 14,
        gap: 8,
        backgroundColor: '#FFF7E7',
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}>
      <Text selectable style={{ fontSize: 14 }}>
        {needsRestore
          ? 'Your saved route could not be restored.'
          : 'Your changes could not be saved on this device.'}
      </Text>
      <Text style={{ fontSize: 12, color: colors.muted }}>
        {needsRestore
          ? 'Retry to keep your saved data, or discard it to start a new route.'
          : 'Keep this app open and try saving again.'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          variant="outline"
          accessibilityLabel={needsRestore ? 'Retry saved route' : 'Retry saving'}
          disabled={saving || isSubmitting}
          onPress={() => {
            if (needsRestore) void route.retryRestore();
            else void route.retrySave();
          }}
          className="h-auto min-h-12">
          <Text>{needsRestore ? 'Retry saved route' : 'Retry saving'}</Text>
        </Button>
        {needsRestore && (
          <Button
            variant="ghost"
            accessibilityLabel="Discard saved route"
            disabled={saving || isSubmitting}
            onPress={() => setConfirmDiscard(true)}
            className="h-auto min-h-12">
            <Text>Discard saved route</Text>
          </Button>
        )}
      </View>
      {confirmDiscard && (
        <ConfirmationDialog
          title="Discard saved route?"
          description="This permanently removes the saved stops and instructions from this device. This cannot be undone."
          confirmLabel="Discard route"
          disabled={saving || isSubmitting}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            void route.discardSavedDraft({ acknowledgeDataLoss: true });
          }}
        />
      )}
    </View>
  );
}
