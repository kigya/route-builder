import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { useRouteDraft } from '@/features/route/RouteProvider';
import { ConfirmationDialog } from '@/features/stops/confirmation-dialog';
import { colors } from '@/theme/tokens';

export function RouteResult() {
  const route = useRouteDraft();
  const marker = route.draft.submission;
  const [retryOpen, setRetryOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const uncertain = marker.status === 'uncertain';
  const succeeded = marker.status === 'succeeded';
  const rejected = marker.status === 'idle' && route.result?.error && !route.storageError;
  if (route.isSubmitting || (!uncertain && !succeeded && !rejected)) return null;
  return (
    <View
      style={{
        marginHorizontal: 14,
        marginBottom: 8,
        padding: 16,
        gap: 10,
        borderRadius: 16,
        backgroundColor: succeeded ? '#E8F2F2' : '#FFF7E7',
      }}>
      <Text
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        style={{ fontSize: 18, fontWeight: '700' }}>
        {succeeded
          ? 'Route created'
          : uncertain
            ? 'Route creation could not be confirmed'
            : 'Route was not created. Your instructions are preserved.'}
      </Text>
      {succeeded && (
        <>
          <Text style={{ fontSize: 12, color: colors.muted }}>Route ID</Text>
          <Text selectable style={{ fontWeight: '700' }}>
            {marker.route.id}
          </Text>
          <Text style={{ fontSize: 13 }}>Your route was created as a draft.</Text>
        </>
      )}
      {uncertain && (
        <>
          <Text selectable style={{ fontSize: 14 }}>
            The request may have created a route. Retrying may create a duplicate. Your stops and
            instructions are preserved.
          </Text>
          <Button
            variant="outline"
            accessibilityLabel="Review retry risk"
            disabled={route.saving}
            onPress={() => {
              setAcknowledged(false);
              setRetryOpen(true);
            }}
            className="h-auto min-h-12">
            <Text>Review retry risk</Text>
          </Button>
        </>
      )}
      {(succeeded || uncertain) && (
        <Button
          accessibilityLabel="Start new route"
          disabled={route.saving}
          onPress={() => setResetOpen(true)}
          className="h-auto min-h-12">
          <Text>Start new route</Text>
        </Button>
      )}
      {retryOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setRetryOpen(false);
          }}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Retry route creation?</DialogTitle>
              <DialogDescription>
                The previous request may have succeeded. Sending again can create a duplicate route.
              </DialogDescription>
            </DialogHeader>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
              <Checkbox
                accessibilityLabel="I understand a retry may create a duplicate route"
                checked={acknowledged}
                onCheckedChange={setAcknowledged}
                disabled={route.isSubmitting}
              />
              <Text style={{ flex: 1, fontSize: 14 }}>
                I understand a retry may create a duplicate route.
              </Text>
            </View>
            <DialogFooter>
              <Button
                variant="outline"
                accessibilityLabel="Cancel"
                onPress={() => setRetryOpen(false)}
                className="h-auto min-h-12">
                <Text>Cancel</Text>
              </Button>
              <Button
                accessibilityLabel="Retry and accept duplicate risk"
                disabled={!acknowledged || route.isSubmitting || route.saving}
                onPress={() => {
                  if (!acknowledged) return;
                  setRetryOpen(false);
                  setAcknowledged(false);
                  void route.retryUncertain({ acknowledgeDuplicateRisk: true });
                }}
                className="h-auto min-h-12">
                <Text>Retry and accept duplicate risk</Text>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {resetOpen && (
        <ConfirmationDialog
          title="Start a new route?"
          description={
            uncertain
              ? 'The previous request may have created a route. This clears the saved stops and instructions on this device without cancelling that request.'
              : 'This clears the saved stops and instructions on this device. The created route is kept.'
          }
          confirmLabel="Clear and start new route"
          disabled={route.saving || route.isSubmitting}
          onCancel={() => setResetOpen(false)}
          onConfirm={() => {
            setResetOpen(false);
            void route.reset({ acknowledgeDataLoss: true });
          }}
        />
      )}
    </View>
  );
}
