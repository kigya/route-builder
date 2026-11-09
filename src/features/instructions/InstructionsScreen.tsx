import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Keyboard, KeyboardAvoidingView, View } from 'react-native';
import type { TextInput } from 'react-native';
import { AppShell, useRouteNavigation } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useRouteDraft } from '@/features/route/RouteProvider';
import type { DraftStop } from '@/features/route/model';
import { DraftRecovery } from '@/features/stops/draft-recovery';
import { colors } from '@/theme/tokens';
import { InstructionCard } from './instruction-card';
import { useReducedMotion } from './use-reduced-motion';
import { RouteResult } from './route-result';

const VIEWABILITY_CONFIG = { viewAreaCoveragePercentThreshold: 35 };

export function InstructionsScreen() {
  const route = useRouteDraft();
  const { draft, ready, canEdit, validation } = route;
  const { openStops } = useRouteNavigation('instructions');
  const reducedMotion = useReducedMotion();
  const [attempted, setAttempted] = useState(false);
  const [activeId, setActiveId] = useState<string>();
  const list = useRef<FlatList<DraftStop>>(null);
  const inputs = useRef(new Map<string, TextInput>());
  const target = useRef<string | undefined>(undefined);
  const jump = useRef<{ index: number; attempts: number } | undefined>(undefined);
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const returnedToStops = useRef(false);
  useEffect(
    () => () => {
      if (jumpTimer.current) clearTimeout(jumpTimer.current);
    },
    []
  );
  const [visible, setVisible] = useState(0);
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      const index = viewableItems[0]?.index;
      if (index != null) setVisible(index);
    },
    []
  );
  useEffect(() => {
    if (!ready || draft.stops.length) {
      returnedToStops.current = false;
      return;
    }
    if (!returnedToStops.current) {
      returnedToStops.current = true;
      openStops();
    }
  }, [ready, draft.stops.length, openStops]);
  const hasResult =
    draft.submission.status === 'succeeded' ||
    draft.submission.status === 'uncertain' ||
    !!route.result?.error;
  useEffect(() => {
    if (route.isSubmitting || !hasResult) return;
    Keyboard.dismiss();
    list.current?.scrollToOffset({ offset: 0, animated: !reducedMotion });
  }, [hasResult, route.isSubmitting, reducedMotion]);
  function finish() {
    setAttempted(true);
    const index = draft.stops.findIndex(
      ({ stop }) => validation[`${stop.id}.instructions`] || validation[`${stop.id}.packages`]
    );
    const invalid = draft.stops[index];
    if (invalid) {
      const { stop } = invalid;
      if (jumpTimer.current) clearTimeout(jumpTimer.current);
      jump.current = { index, attempts: 0 };
      target.current = stop.id;
      setActiveId(stop.id);
      list.current?.scrollToIndex({ index, animated: !reducedMotion, viewPosition: 0 });
      inputs.current.get(stop.id)?.focus();
      AccessibilityInfo.announceForAccessibility(
        `${stop.name}: ${validation[`${stop.id}.instructions`] ?? validation[`${stop.id}.packages`]}`
      );
      return;
    }
    Keyboard.dismiss();
    void route.submit();
  }
  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      <AppShell active="instructions">
        <DraftRecovery />
        <FlatList
          ref={list}
          testID="instructions-feed"
          data={draft.stops}
          keyExtractor={(entry) => entry.stop.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="automatic"
          ListHeaderComponent={<RouteResult />}
          initialNumToRender={3}
          windowSize={5}
          contentContainerStyle={{ paddingVertical: 8 }}
          onScrollBeginDrag={() => setActiveId(undefined)}
          viewabilityConfig={VIEWABILITY_CONFIG}
          onViewableItemsChanged={onViewableItemsChanged}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            const pending = jump.current;
            if (!pending || pending.index !== index || pending.attempts >= 4) return;
            pending.attempts++;
            if (jumpTimer.current) clearTimeout(jumpTimer.current);
            list.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
            // Let virtualization measure the nearby cells before an exact retry.
            jumpTimer.current = setTimeout(() => {
              if (jump.current !== pending) return;
              list.current?.scrollToIndex({ index, animated: !reducedMotion, viewPosition: 0 });
            }, 100);
          }}
          renderItem={({ item, index }) => (
            <InstructionCard
              entry={item}
              api={route.api}
              photosVisible={Math.abs(index - visible) <= 1}
              active={item.stop.id === (activeId ?? draft.stops[visible]?.stop.id)}
              reducedMotion={reducedMotion}
              canEdit={canEdit}
              inputRef={(input) => {
                if (input) {
                  inputs.current.set(item.stop.id, input);
                  if (target.current === item.stop.id) {
                    input.focus();
                    target.current = undefined;
                  }
                } else inputs.current.delete(item.stop.id);
              }}
              error={
                attempted || item.instructions.length > 0
                  ? (validation[`${item.stop.id}.instructions`] ??
                    validation[`${item.stop.id}.packages`])
                  : undefined
              }
              onFocus={() => setActiveId(item.stop.id)}
              onChange={(text) =>
                route.dispatch({ type: 'setInstructions', id: item.stop.id, text })
              }
              onClear={() => route.dispatch({ type: 'clearInstructions', id: item.stop.id })}
              onRemove={() => {
                setActiveId(undefined);
                target.current = undefined;
                jump.current = undefined;
                if (jumpTimer.current) clearTimeout(jumpTimer.current);
                route.dispatch({ type: 'removeStop', id: item.stop.id });
              }}
            />
          )}
        />
        {(draft.submission.status === 'idle' || route.isSubmitting) && (
          <View
            style={{
              padding: 14,
              gap: 8,
              backgroundColor: colors.card,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Instructions save automatically on this device.
            </Text>
            <Button
              accessibilityLabel={
                route.result?.error && !route.storageError
                  ? 'Retry route creation'
                  : 'Finish instructions'
              }
              disabled={!canEdit || route.saving || !!route.storageError || !draft.stops.length}
              onPress={finish}
              className="h-auto min-h-12 rounded-xl py-3">
              <Text style={{ fontWeight: '700', fontSize: 16 }}>
                {route.isSubmitting
                  ? 'Creating route…'
                  : route.result?.error && !route.storageError
                    ? 'Retry route creation'
                    : 'Finish instructions'}
              </Text>
            </Button>
          </View>
        )}
      </AppShell>
    </KeyboardAvoidingView>
  );
}
