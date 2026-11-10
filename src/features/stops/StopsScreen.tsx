import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, SectionList, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import type { Stop } from '@/api/types';
import { KeyboardScreen } from '@/components/keyboard-screen';
import { AppShell, useRouteNavigation } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useRouteDraft } from '@/features/route/RouteProvider';
import { colors } from '@/theme/tokens';
import { ConfirmationDialog } from './confirmation-dialog';
import { DraftRecovery } from './draft-recovery';
import { groupStops } from './groupStops';
import type { StopSection } from './groupStops';
import { QuantityDialog } from './quantity-dialog';
import { StopRow } from './stop-row';
import { useStopSearch } from './useStopSearch';

type Confirmation = { type: 'replace'; stop: Stop } | { type: 'single' };
export function StopsScreen(): ReactElement {
  const route = useRouteDraft();
  const { api, draft, canEdit } = route;
  const { canViewInstructions, openInstructions } = useRouteNavigation('stops');
  const [query, setQuery] = useState('');
  const search = useStopSearch(api, query);
  const sections = groupStops(search.data);
  const [editingId, setEditingId] = useState<string>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const list = useRef<SectionList<Stop, StopSection>>(null);
  const jump = useRef<{ sectionIndex: number; attempts: number } | undefined>(undefined);
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (jumpTimer.current) clearTimeout(jumpTimer.current);
    },
    []
  );
  useEffect(() => {
    jump.current = undefined;
    if (jumpTimer.current) clearTimeout(jumpTimer.current);
  }, [query]);
  const editing = draft.stops.find((entry) => entry.stop.id === editingId);
  const first = draft.stops[0];
  function selectStop(stop: Stop) {
    if (!canEdit) return;
    const selected = draft.stops.find((entry) => entry.stop.id === stop.id);
    if (selected) {
      route.dispatch({ type: 'removeStop', id: stop.id });
      return;
    }
    if (draft.mode === 'single' && first?.instructions.trim())
      setConfirmation({ type: 'replace', stop });
    else route.dispatch({ type: 'selectStop', stop });
  }
  function selectSingle() {
    if (!canEdit) return;
    if (draft.stops.length > 1) setConfirmation({ type: 'single' });
    else route.dispatch({ type: 'setMode', mode: 'single' });
  }
  const count = draft.stops.length;
  const continueLabel = `Continue (${count} ${count === 1 ? 'stop' : 'stops'})`;
  return (
    <KeyboardScreen>
      <AppShell active="stops">
        <DraftRecovery />
        <View style={{ paddingHorizontal: 14, paddingTop: 12, gap: 10, paddingBottom: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              padding: 4,
              backgroundColor: colors.card,
            }}>
            <Button
              accessibilityLabel="One stop"
              accessibilityState={{ selected: draft.mode === 'single' }}
              disabled={!canEdit}
              onPress={selectSingle}
              variant={draft.mode === 'single' ? 'default' : 'ghost'}
              className="h-auto min-h-14 flex-1 flex-col gap-0 rounded-xl px-2 py-2">
              <Text style={{ fontWeight: '700', textAlign: 'center', fontSize: 15 }}>One stop</Text>
              <Text
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  color: draft.mode === 'single' ? 'white' : colors.muted,
                }}>
                Single delivery
              </Text>
            </Button>
            <Button
              accessibilityLabel="Multi-stop route"
              accessibilityState={{ selected: draft.mode === 'multi' }}
              disabled={!canEdit}
              onPress={() => route.dispatch({ type: 'setMode', mode: 'multi' })}
              variant={draft.mode === 'multi' ? 'default' : 'ghost'}
              className="h-auto min-h-14 flex-1 flex-col gap-0 rounded-xl px-2 py-2">
              <Text style={{ fontWeight: '700', textAlign: 'center', fontSize: 15 }}>
                Multi-stop route
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  textAlign: 'center',
                  color: draft.mode === 'multi' ? 'white' : colors.muted,
                }}>
                Several stops
              </Text>
            </Button>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderRadius: 13,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              paddingRight: 12,
            }}>
            <Input
              accessibilityLabel="Search stops"
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, street, or phone"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              className="h-auto min-h-12 flex-1 border-0 bg-transparent text-sm shadow-none"
              style={{ paddingVertical: 12 }}
            />
            {query ? (
              <Button
                variant="ghost"
                accessibilityLabel="Clear search"
                onPress={() => setQuery('')}
                className="size-12">
                <X color={colors.muted} size={19} />
              </Button>
            ) : (
              <Search accessible={false} color={colors.muted} size={20} />
            )}
          </View>
        </View>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <SectionList
            ref={list}
            testID="stops-list"
            style={{ flex: 1 }}
            sections={sections}
            keyExtractor={(stop) => stop.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentInsetAdjustmentBehavior="automatic"
            stickySectionHeadersEnabled
            initialNumToRender={12}
            renderSectionHeader={({ section }) => (
              <Text
                accessibilityRole="header"
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  backgroundColor: colors.background,
                  color: colors.muted,
                  fontWeight: '700',
                  fontSize: 13,
                }}>
                {section.title}
              </Text>
            )}
            renderItem={({ item }) => (
              <StopRow
                stop={item}
                packages={draft.stops.find((entry) => entry.stop.id === item.id)?.packages}
                canEdit={canEdit}
                onSelect={() => selectStop(item)}
                onEdit={() => setEditingId(item.id)}
              />
            )}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              const target = jump.current;
              if (!target || target.attempts >= 4) return;
              target.attempts++;
              list.current
                ?.getScrollResponder()
                ?.scrollTo({ y: index * averageItemLength, animated: false });
              jumpTimer.current = setTimeout(() => {
                list.current?.scrollToLocation({
                  sectionIndex: target.sectionIndex,
                  itemIndex: 1,
                  viewOffset: 28,
                  animated: true,
                });
              }, 100);
            }}
            ListEmptyComponent={
              <View style={{ padding: 24, gap: 10, alignItems: 'center' }}>
                {search.loading ? (
                  <>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={{ color: colors.muted }}>Loading stops…</Text>
                  </>
                ) : search.error ? (
                  <>
                    <Text selectable style={{ textAlign: 'center' }}>
                      Stops could not be loaded. Please try again.
                    </Text>
                    <Button
                      variant="outline"
                      accessibilityLabel="Retry stops"
                      onPress={search.retry}
                      className="h-auto min-h-12">
                      <Text>Retry</Text>
                    </Button>
                  </>
                ) : (
                  <>
                    <Text style={{ fontWeight: '700' }}>No stops found</Text>
                    <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 13 }}>
                      Try the same capitalization as the name or street, or at least three phone
                      digits.
                    </Text>
                  </>
                )}
              </View>
            }
          />
          {sections.length > 1 && (
            <ScrollView
              style={{ width: 32, flexGrow: 0 }}
              contentContainerStyle={{ paddingVertical: 8 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              accessibilityLabel="Alphabetical index">
              {sections.map((section, sectionIndex) => (
                <Button
                  key={section.title}
                  accessibilityLabel={`Jump to ${section.title}`}
                  variant="ghost"
                  className="h-auto min-h-12 w-8 rounded-none px-0"
                  onPress={() => {
                    if (jumpTimer.current) clearTimeout(jumpTimer.current);
                    jump.current = { sectionIndex, attempts: 0 };
                    // Native sticky headers can report offset zero; target the first row.
                    list.current?.scrollToLocation({
                      sectionIndex,
                      itemIndex: 1,
                      viewOffset: 28,
                      animated: true,
                    });
                  }}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
                    {section.title}
                  </Text>
                </Button>
              ))}
            </ScrollView>
          )}
        </View>
        <View
          style={{
            backgroundColor: colors.card,
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingTop: count ? 8 : 12,
            paddingBottom: 12,
            gap: 8,
          }}>
          {count > 0 && (
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}
              style={{ flexGrow: 0 }}
              accessibilityLabel="Selected stops">
              {draft.stops.map((entry) => (
                <View
                  key={entry.stop.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#E8F2F2',
                    borderRadius: 12,
                  }}>
                  <Button
                    variant="ghost"
                    disabled={!canEdit}
                    accessibilityLabel={`Edit selected packages for ${entry.stop.name}`}
                    onPress={() => setEditingId(entry.stop.id)}
                    className="h-auto min-h-12 max-w-56 px-3 py-2">
                    <Text style={{ fontSize: 12, color: colors.primary }}>
                      {entry.stop.name} {entry.packages}×
                    </Text>
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!canEdit}
                    accessibilityLabel={`Remove ${entry.stop.name}`}
                    onPress={() => route.dispatch({ type: 'removeStop', id: entry.stop.id })}
                    className="size-12 rounded-xl">
                    <X color={colors.primary} size={16} />
                  </Button>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={{ paddingHorizontal: 14 }}>
            <Button
              accessibilityLabel={continueLabel}
              disabled={!canViewInstructions}
              onPress={openInstructions}
              className="h-auto min-h-12 rounded-xl py-3">
              <Text style={{ fontSize: 16, fontWeight: '700' }}>{continueLabel}</Text>
            </Button>
          </View>
        </View>
        {editing && (
          <QuantityDialog
            key={editing.stop.id}
            entry={editing}
            canEdit={canEdit}
            onCancel={() => setEditingId(undefined)}
            onSave={(packages) => {
              route.dispatch({ type: 'setPackages', id: editing.stop.id, packages });
              setEditingId(undefined);
            }}
          />
        )}
        {confirmation && (
          <ConfirmationDialog
            title={
              confirmation.type === 'replace'
                ? `Replace ${first?.stop.name ?? 'selected stop'}?`
                : `Keep ${first?.stop.name ?? 'the first stop'}?`
            }
            description={
              confirmation.type === 'replace'
                ? 'The selected stop and its instructions will be removed from this route.'
                : 'Switching to One stop removes all other stops and their instructions.'
            }
            confirmLabel={confirmation.type === 'replace' ? 'Replace stop' : 'Keep first stop'}
            disabled={!canEdit}
            onCancel={() => setConfirmation(undefined)}
            onConfirm={() => {
              if (confirmation.type === 'replace')
                route.dispatch({ type: 'confirmSingleReplacement', stop: confirmation.stop });
              else route.dispatch({ type: 'confirmModeChange', mode: 'single' });
              setConfirmation(undefined);
            }}
          />
        )}
      </AppShell>
    </KeyboardScreen>
  );
}
