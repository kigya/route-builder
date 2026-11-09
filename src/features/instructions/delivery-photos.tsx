import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import type { DeliveryPhoto, RouteApi } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors } from '@/theme/tokens';
import { photoResource } from './photo-cache';
function Photo({ photo }: { photo: DeliveryPhoto }) {
  const [failed, setFailed] = useState(false);
  return (
    <View
      style={{
        width: 100,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}>
      {failed ? (
        <View style={{ minHeight: 72, padding: 8, justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Photo unavailable</Text>
        </View>
      ) : (
        <Image
          accessibilityLabel={`Previous delivery: ${photo.tag}`}
          source={{ uri: photo.url }}
          resizeMode="cover"
          style={{ width: 100, height: 72 }}
          onError={() => setFailed(true)}
        />
      )}
      <Text
        style={{
          backgroundColor: '#56636D',
          color: 'white',
          textAlign: 'center',
          fontSize: 12,
          padding: 4,
        }}>
        {photo.tag}
      </Text>
    </View>
  );
}
export function DeliveryPhotos({
  api,
  stopId,
  visible,
}: {
  api: RouteApi;
  stopId: string;
  visible: boolean;
}) {
  const resource = useMemo(() => photoResource(api, stopId), [api, stopId]);
  const state = useSyncExternalStore(resource.subscribe, resource.snapshot, resource.snapshot);
  useEffect(() => {
    if (visible) return resource.retain();
    return undefined;
  }, [resource, visible]);
  if (state.status === 'idle' || state.status === 'loading')
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.muted, fontSize: 13 }}>Loading previous delivery photos…</Text>
      </View>
    );
  if (state.status === 'error')
    return (
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: colors.muted, fontSize: 13 }}>
          Previous delivery photos could not be loaded.
        </Text>
        <Button
          variant="outline"
          accessibilityLabel={`Retry photos for ${stopId}`}
          onPress={resource.retry}
          className="h-auto min-h-12">
          <Text>Retry photos</Text>
        </Button>
      </View>
    );
  if (!state.photos.length)
    return <Text style={{ color: colors.muted, fontSize: 13 }}>No previous delivery photos</Text>;
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
      style={{ flexGrow: 0 }}
      accessibilityLabel="Previous delivery photos">
      {state.photos.map((photo) => (
        <Photo key={`${photo.id}:${photo.url}`} photo={photo} />
      ))}
    </ScrollView>
  );
}
