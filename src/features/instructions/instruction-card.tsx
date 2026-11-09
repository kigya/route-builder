import { useEffect, useMemo, useState } from 'react';
import type { RefCallback } from 'react';
import type { TextInput } from 'react-native';
import { Animated, PanResponder, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import type { DraftStop } from '@/features/route/model';
import { colors } from '@/theme/tokens';
import type { RouteApi } from '@/api/types';
import { DeliveryPhotos } from './delivery-photos';

export function InstructionCard({
  entry,
  api,
  photosVisible,
  active,
  reducedMotion,
  canEdit,
  error,
  inputRef,
  onFocus,
  onChange,
  onClear,
  onRemove,
}: {
  entry: DraftStop;
  api: RouteApi;
  photosVisible: boolean;
  active: boolean;
  reducedMotion: boolean;
  canEdit: boolean;
  error: string | undefined;
  inputRef: RefCallback<TextInput>;
  onFocus: () => void;
  onChange: (text: string) => void;
  onClear: () => void;
  onRemove: () => void;
}) {
  const [emphasis] = useState(() => new Animated.Value(active ? 1 : 0));
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    if (reducedMotion) {
      emphasis.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.timing(emphasis, {
      toValue: active ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, emphasis, reducedMotion]);
  // Only the header is a swipe target: fields, photo strips and vertical scroll remain native.
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          canEdit && Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 2,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -48) setRevealed(true);
          else if (gesture.dx > 48) setRevealed(false);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [canEdit]
  );
  return (
    <Animated.View
      testID={`instruction-card-${entry.stop.id}`}
      accessibilityState={{ selected: active }}
      style={{
        marginHorizontal: 14,
        marginVertical: 10,
        padding: 14,
        gap: 10,
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        opacity: reducedMotion
          ? active
            ? 1
            : 0.76
          : emphasis.interpolate({ inputRange: [0, 1], outputRange: [0.76, 1] }),
        transform: [
          {
            scale: reducedMotion
              ? active
                ? 1
                : 0.96
              : emphasis.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
          },
        ],
      }}>
      <View
        {...swipe.panHandlers}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 12,
          padding: 12,
          gap: 10,
        }}>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>
          {entry.stop.name}
        </Text>
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 18 }}>
          {entry.packages}×
        </Text>
      </View>
      {revealed && (
        <Button
          variant="destructive"
          disabled={!canEdit}
          accessibilityLabel={`Remove revealed ${entry.stop.name}`}
          onPress={onRemove}
          className="h-auto min-h-12">
          <Text>Remove stop</Text>
        </Button>
      )}
      <Text selectable style={{ color: colors.primary, fontSize: 14 }}>
        {entry.stop.address}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13 }}>Photos from the last delivery</Text>
      <DeliveryPhotos api={api} stopId={entry.stop.id} visible={photosVisible} />
      <Input
        ref={inputRef}
        accessibilityLabel={`Instructions for ${entry.stop.name}`}
        accessibilityHint="Required. Up to 200 UTF-16 units."
        multiline
        editable={canEdit}
        value={entry.instructions}
        onChangeText={onChange}
        onFocus={onFocus}
        placeholder="Add delivery instructions"
        textAlignVertical="top"
        className="h-auto min-h-32 rounded-xl bg-white p-3 text-base shadow-none"
        style={{ minHeight: 132, borderColor: error ? '#B42318' : colors.border }}
      />
      {error && (
        <Text
          selectable
          accessibilityLiveRegion="polite"
          style={{ color: '#B42318', fontSize: 13 }}>
          {error}
        </Text>
      )}
      <Text style={{ color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>
        {entry.instructions.length}/200 UTF-16 units
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Button
          variant="ghost"
          accessibilityLabel={`Clear instructions for ${entry.stop.name}`}
          disabled={!canEdit}
          onPress={onClear}
          className="h-auto min-h-12 px-2">
          <Text style={{ color: colors.muted, textDecorationLine: 'underline' }}>Clear all</Text>
        </Button>
        <Button
          variant="ghost"
          accessibilityLabel={`Remove ${entry.stop.name}`}
          disabled={!canEdit}
          onPress={onRemove}
          className="h-auto min-h-12 px-2">
          <Text style={{ color: '#B42318' }}>Remove</Text>
        </Button>
      </View>
    </Animated.View>
  );
}
