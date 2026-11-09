import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import type { Stop } from '@/api/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';
export function StopRow({
  stop,
  packages,
  canEdit,
  onSelect,
  onEdit,
}: {
  stop: Stop;
  packages: number | undefined;
  canEdit: boolean;
  onSelect: () => void;
  onEdit: () => void;
}): ReactElement {
  const words = stop.name.trim().split(/\s+/);
  const initials = [words[0]?.[0], words.length > 1 ? words[words.length - 1]?.[0] : undefined]
    .join('')
    .toUpperCase();
  const selected = packages !== undefined;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: colors.card,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
      }}>
      <View style={{ width: 28, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Checkbox
          checked={selected}
          disabled={!canEdit}
          accessibilityLabel={`${selected ? 'Selected' : 'Select'} ${stop.name}`}
          onCheckedChange={onSelect}
          hitSlop={12}
          className="size-6 rounded-md"
        />
      </View>
      <Pressable
        accessible={false}
        disabled={!canEdit}
        onPress={onSelect}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64 }}>
        <Avatar alt={stop.name} className="size-10 rounded-xl">
          <AvatarFallback className="rounded-xl bg-[#DCEBEB]">
            <Text style={{ fontWeight: '700', fontSize: 13 }}>{initials}</Text>
          </AvatarFallback>
        </Avatar>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', lineHeight: 21 }}>{stop.name}</Text>
          <Text style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}>{stop.address}</Text>
          <Text selectable style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}>
            {stop.phone || 'No phone number'}
          </Text>
        </View>
      </Pressable>
      {selected && (
        <Button
          accessibilityLabel={`Edit packages for ${stop.name}`}
          disabled={!canEdit}
          onPress={onEdit}
          className="h-auto min-h-12 min-w-12 rounded-xl px-2 py-2">
          <Text style={{ fontVariant: ['tabular-nums'] }}>{packages}×</Text>
        </Button>
      )}
    </View>
  );
}
