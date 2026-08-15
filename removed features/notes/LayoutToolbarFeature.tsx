/**
 * BACKUP OF REMOVED FEATURE: Page Layout (Page Size, Orientation, Margins, Line Spacing)
 * Removed on request to simplify the app and reduce bundle size.
 *
 * This file contains the toolbar components, state management, and handlers
 * for the "Layout" tab in NoteToolbar.tsx.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Constants ──────────────────────────────────────────────────────────────

export const PAGE_SIZES = [
  { id: 'pageless', label: 'Pageless', desc: 'Infinite scroll' },
  { id: 'a4', label: 'A4', desc: '8.27" × 11.69"' },
  { id: 'letter', label: 'Letter', desc: '8.5" × 11"' },
  { id: 'legal', label: 'Legal', desc: '8.5" × 14"' },
  { id: 'tabloid', label: 'Tabloid', desc: '11" × 17"' },
  { id: 'a3', label: 'A3', desc: '11.69" × 16.54"' },
  { id: 'a5', label: 'A5', desc: '5.83" × 8.27"' },
  { id: 'b4', label: 'B4', desc: '9.84" × 13.90"' },
  { id: 'b5', label: 'B5', desc: '6.93" × 9.84"' },
  { id: 'statement', label: 'Statement', desc: '5.5" × 8.5"' },
  { id: 'executive', label: 'Executive', desc: '7.25" × 10.5"' },
  { id: 'folio', label: 'Folio', desc: '8.5" × 13"' },
];

export const MARGIN_OPTIONS = [
  { id: 'narrow', label: 'Narrow', desc: '0.25"' },
  { id: 'normal', label: 'Normal', desc: '0.4"' },
  { id: 'moderate', label: 'Moderate', desc: '0.75"' },
  { id: 'wide', label: 'Wide', desc: '1"' },
];

export const LINE_SPACINGS = [
  { id: '1', label: 'Single', desc: '1' },
  { id: '1.15', label: '1.15 Lines', desc: '1.15' },
  { id: '1.5', label: '1.5 Lines', desc: '1.5' },
  { id: '2', label: 'Double', desc: '2' },
  { id: '2.5', label: '2.5 Lines', desc: '2.5' },
  { id: '3', label: 'Triple', desc: '3' },
];

export type LayoutSubPanel = 'pageSize' | 'orientation' | 'margins' | 'lineSpacing';

export interface PageLayoutState {
  pageSize: string;
  orientation: 'portrait' | 'landscape';
  margins: string;
  lineSpacing: string;
}

// ─── Example Toolbar Layout Tab & Sub-panels ─────────────────────────────────

export function usePageLayout(sendCommand: (type: string, payload?: string) => void) {
  const [pageSize, setPageSize] = useState('pageless');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margins, setMargins] = useState('normal');
  const [lineSpacing, setLineSpacing] = useState('1');

  const sendPageLayout = (overrides: Partial<PageLayoutState> = {}) => {
    const layout = { pageSize, orientation, margins, lineSpacing, ...overrides };
    sendCommand('PAGE_LAYOUT', JSON.stringify(layout));
  };

  return {
    pageSize,
    setPageSize,
    orientation,
    setOrientation,
    margins,
    setMargins,
    lineSpacing,
    setLineSpacing,
    sendPageLayout,
  };
}

/**
 * Renders the Layout tab content
 */
export function renderLayoutTabCodeSnippet({
  pageSize,
  orientation,
  margins,
  lineSpacing,
  setSubPanel,
  cmd,
  selectionState,
  themeColors,
  RowComponent,
}: any) {
  const { blue, textPri, textSec, borderHair, border } = themeColors;

  return (
    <View>
      <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border }]}>
        <View style={{ flex: 4, flexDirection: 'row' }}>
          {[
            { a: 'left', icon: 'format-align-left' },
            { a: 'center', icon: 'format-align-center' },
            { a: 'right', icon: 'format-align-right' },
            { a: 'justify', icon: 'format-align-justify' },
          ].map(({ a, icon }) => (
            <View key={a} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <TouchableOpacity style={[{ width: 38, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, selectionState.align === a && { backgroundColor: blue + '15' }]} onPress={() => cmd('FORMAT_ELEMENT', a)}>
                <MaterialIcons name={icon as any} size={20} color={selectionState.align === a ? blue : textPri} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={[{ width: StyleSheet.hairlineWidth, height: 22, marginHorizontal: 4, backgroundColor: border }]} />

        <View style={{ flex: 2, flexDirection: 'row' }}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity style={{ width: 38, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }} onPress={() => cmd('OUTDENT')}>
              <MaterialIcons name="format-indent-decrease" size={20} color={textPri} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity style={{ width: 38, height: 38, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }} onPress={() => cmd('INDENT')}>
              <MaterialIcons name="format-indent-increase" size={20} color={textPri} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <RowComponent icon="article" label="Page Size" rightText={PAGE_SIZES.find(p => p.id === pageSize)?.label ?? 'A4'} onPress={() => setSubPanel('pageSize')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
      <RowComponent icon={orientation === 'portrait' ? 'crop-portrait' : 'crop-landscape'} label="Orientation" rightText={orientation === 'portrait' ? 'Portrait' : 'Landscape'} onPress={() => setSubPanel('orientation')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
      <RowComponent icon="margin" label="Margins" rightText={MARGIN_OPTIONS.find(m => m.id === margins)?.label ?? 'Normal'} onPress={() => setSubPanel('margins')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
      <RowComponent icon="format-line-spacing" label="Line Spacing" rightText={LINE_SPACINGS.find(l => l.id === lineSpacing)?.label ?? 'Single'} onPress={() => setSubPanel('lineSpacing')} textPri={textPri} textSec={textSec} borderCol={borderHair} blue={blue} />
    </View>
  );
}

/**
 * Sub-panel render functions
 */
export function renderPageSizePanelCodeSnippet({ pageSize, setPageSize, sendPageLayout, setSubPanel, themeColors }: any) {
  const { blue, textPri, textSec, borderHair } = themeColors;
  return (
    <View>
      {PAGE_SIZES.map(p => {
        const isActive = pageSize === p.id;
        return (
          <TouchableOpacity key={p.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderHair }} onPress={() => { setPageSize(p.id); sendPageLayout({ pageSize: p.id }); setSubPanel('none'); }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }}>{p.label}</Text>
              <Text style={{ fontSize: 12, color: textSec, marginTop: 1 }}>{p.desc}</Text>
            </View>
            {isActive && <MaterialIcons name="check" size={20} color={blue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function renderOrientationPanelCodeSnippet({ orientation, setOrientation, sendPageLayout, setSubPanel, themeColors }: any) {
  const { blue, textPri, textSec, borderHair } = themeColors;
  return (
    <View>
      {(['portrait', 'landscape'] as const).map(o => {
        const isActive = orientation === o;
        return (
          <TouchableOpacity key={o} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderHair }} onPress={() => { setOrientation(o); sendPageLayout({ orientation: o }); setSubPanel('none'); }}>
            <MaterialIcons name={o === 'portrait' ? 'crop-portrait' : 'crop-landscape'} size={20} color={isActive ? blue : textSec} style={{ marginRight: 12 }} />
            <Text style={{ fontSize: 15, color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }}>
              {o === 'portrait' ? 'Portrait' : 'Landscape'}
            </Text>
            {isActive && <MaterialIcons name="check" size={20} color={blue} style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function renderMarginsPanelCodeSnippet({ margins, setMargins, sendPageLayout, setSubPanel, themeColors }: any) {
  const { blue, textPri, textSec, borderHair } = themeColors;
  return (
    <View>
      {MARGIN_OPTIONS.map(m => {
        const isActive = margins === m.id;
        return (
          <TouchableOpacity key={m.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderHair }} onPress={() => { setMargins(m.id); sendPageLayout({ margins: m.id }); setSubPanel('none'); }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }}>{m.label}</Text>
              <Text style={{ fontSize: 12, color: textSec, marginTop: 1 }}>{m.desc}</Text>
            </View>
            {isActive && <MaterialIcons name="check" size={20} color={blue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function renderLineSpacingPanelCodeSnippet({ lineSpacing, setLineSpacing, sendPageLayout, setSubPanel, themeColors }: any) {
  const { blue, textPri, textSec, borderHair } = themeColors;
  return (
    <View>
      {LINE_SPACINGS.map(l => {
        const isActive = lineSpacing === l.id;
        return (
          <TouchableOpacity key={l.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderHair }} onPress={() => { setLineSpacing(l.id); sendPageLayout({ lineSpacing: l.id }); setSubPanel('none'); }}>
            <Text style={{ fontSize: 15, color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }}>{l.label}</Text>
            {isActive && <MaterialIcons name="check" size={20} color={blue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
