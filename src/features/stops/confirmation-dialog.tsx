import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import type { ReactElement } from 'react';
export function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  disabled,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}): ReactElement {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            accessibilityLabel="Cancel"
            onPress={onCancel}
            className="h-auto min-h-12">
            <Text>Cancel</Text>
          </Button>
          <Button
            accessibilityLabel={confirmLabel}
            disabled={disabled}
            onPress={onConfirm}
            className="h-auto min-h-12">
            <Text>{confirmLabel}</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
