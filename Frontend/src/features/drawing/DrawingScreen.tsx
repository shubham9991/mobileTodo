/**
 * DrawingScreen — route-level wrapper.
 * Reads drawingId & drawingTitle from router params,
 * loads the existing snapshot, and renders DrawingEditor.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../themes/ThemeContext';
import { getDrawing } from './drawingStore';
import { DrawingEditor } from './DrawingEditor';

export function DrawingScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { drawingId, drawingTitle } = useLocalSearchParams<{
    drawingId: string;
    drawingTitle?: string;
  }>();

  const [snapshotJson, setSnapshotJson] = useState<string | null | undefined>(undefined);

  // Load existing snapshot from file system
  useEffect(() => {
    if (!drawingId) return;
    getDrawing(drawingId).then(setSnapshotJson);
  }, [drawingId]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/notes');
  }, [router]);

  // Still loading snapshot
  if (snapshotJson === undefined) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <DrawingEditor
      drawingId={drawingId}
      initialTitle={(drawingTitle as string) || 'Untitled Sketch'}
      initialSnapshotJson={snapshotJson}
      onBack={handleBack}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
