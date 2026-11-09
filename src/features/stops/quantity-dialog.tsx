import type { ReactElement } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
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
import type { DraftStop } from '@/features/route/model';
import { packageLimit } from '@/features/route/validation';
import { colors } from '@/theme/tokens';
export function QuantityDialog({
  entry,
  canEdit,
  onCancel,
  onSave,
}: {
  entry: DraftStop;
  canEdit: boolean;
  onCancel: () => void;
  onSave: (packages: number) => void;
}): ReactElement {
  const [packages, setPackages] = useState(entry.packages);
  const max = packageLimit(entry.stop);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}>
      <DialogContent className="bg-white">
        <DialogHeader>
          <DialogTitle>Package quantity</DialogTitle>
          <DialogDescription>{entry.stop.name}</DialogDescription>
        </DialogHeader>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <Button
            variant="outline"
            accessibilityLabel="Decrease packages"
            disabled={!canEdit || packages <= 1}
            onPress={() => setPackages((value) => Math.max(1, value - 1))}
            className="size-12">
            <Minus color={colors.text} size={20} />
          </Button>
          <Text
            accessibilityLabel="Package quantity"
            style={{ fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
            {packages}
          </Text>
          <Button
            variant="outline"
            accessibilityLabel="Increase packages"
            disabled={!canEdit || packages >= max}
            onPress={() => setPackages((value) => Math.min(max, value + 1))}
            className="size-12">
            <Plus color={colors.text} size={20} />
          </Button>
        </View>
        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 13 }}>
          1–{max} packages{entry.stop.packagesMax === null ? ' (app limit)' : ''}
        </Text>
        <DialogFooter>
          <Button
            variant="outline"
            accessibilityLabel="Cancel"
            onPress={onCancel}
            className="h-auto min-h-12">
            <Text>Cancel</Text>
          </Button>
          <Button
            accessibilityLabel="Save packages"
            disabled={!canEdit}
            onPress={() => onSave(packages)}
            className="h-auto min-h-12">
            <Text>Save</Text>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
