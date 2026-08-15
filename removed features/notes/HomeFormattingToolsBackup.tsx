/**
 * BACKUP OF REMOVED FEATURES:
 * 1. Font Size (Constants, sub-panel, stepper logic)
 * 2. Change Case / Text Transform (Uppercase, Lowercase, Capitalize)
 * 3. Paragraph Styles (Normal, Heading 1, Heading 2, Heading 3, Quote previews)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ─── 1. Font Size ─────────────────────────────────────────────────────────────

export const FONT_SIZES = [
  '8', '9', '10', '11', '12', '14', '16',
  '18', '20', '22', '24', '26', '28', '36', '48', '72',
];

export function renderFontSizePanelCodeSnippet({
  FONT_SIZES,
  currentFontSizeNum,
  cmd,
  setSubPanel,
  themeColors,
}: any) {
  const { blue, textPri, borderHair } = themeColors;
  return (
    <View>
      {FONT_SIZES.map((sz: string) => {
        const isActive = currentFontSizeNum === parseInt(sz, 10);
        return (
          <TouchableOpacity
            key={sz}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              minHeight: 50,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: borderHair,
            }}
            onPress={() => {
              cmd('SET_FONT_SIZE', `${sz}px`);
              setSubPanel('none');
            }}
          >
            <Text style={{ fontSize: 15, color: isActive ? blue : textPri, fontWeight: isActive ? '600' : '400' }}>
              {sz}
            </Text>
            {isActive && <MaterialIcons name="check" size={20} color={blue} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function renderFontSizeStepperCodeSnippet({
  border,
  changeFontSize,
  setSubPanel,
  currentFontSizeNum,
  textPri,
}: any) {
  return (
    <View style={{ width: 100, height: 38, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: border, borderRadius: 6, overflow: 'hidden' }}>
      <TouchableOpacity style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' }} onPress={() => changeFontSize(-1)}>
        <MaterialIcons name="remove" size={18} color={textPri} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setSubPanel('fontSize')} style={{ width: 32, height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: textPri }}>{currentFontSizeNum}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center' }} onPress={() => changeFontSize(1)}>
        <MaterialIcons name="add" size={18} color={textPri} />
      </TouchableOpacity>
    </View>
  );
}

// ─── 2. Change Case (Text Transform) ──────────────────────────────────────────

export function renderTextTransformPanelCodeSnippet({
  cmd,
  setSubPanel,
  themeColors,
}: any) {
  const { blue, textPri, textSec, border, surface, surfaceSub } = themeColors;
  return (
    <View style={{ padding: 12, gap: 10 }}>
      {[
        { id: 'uppercase', display: 'AA', title: 'UPPERCASE', desc: 'ALL LETTERS CAPITALIZED' },
        { id: 'lowercase', display: 'aa', title: 'lowercase', desc: 'all letters lowercase' },
        { id: 'capitalize', display: 'Aa', title: 'Capitalize Each Word', desc: 'Title Case' },
      ].map(t => (
        <TouchableOpacity
          key={t.id}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: border,
            borderRadius: 10,
            backgroundColor: surface,
          }}
          onPress={() => { cmd('TEXT_TRANSFORM', t.id); setSubPanel('none'); }}
          activeOpacity={0.7}
        >
          <View style={{ width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: surfaceSub }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: blue }}>{t.display}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: textPri }}>{t.title}</Text>
            <Text style={{ fontSize: 12, color: textSec, marginTop: 2 }}>{t.desc}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={textSec} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── 3. Styles / Paragraph Styles ────────────────────────────────────────────

export const PARA_STYLES = [
  { id: 'paragraph', label: 'Normal', cmd: 'SET_PARAGRAPH', previewText: 'AaBbCcDd', subLabel: 'Normal', fontSize: 13, bold: false, italic: false },
  { id: 'h1', label: 'Heading 1', cmd: 'SET_HEADING', payload: 'h1', previewText: 'AaBbCcDd', subLabel: 'Heading 1', fontSize: 17, bold: true, italic: false },
  { id: 'h2', label: 'Heading 2', cmd: 'SET_HEADING', payload: 'h2', previewText: 'AaBbCcDd', subLabel: 'Heading 2', fontSize: 15, bold: true, italic: false },
  { id: 'h3', label: 'Heading 3', cmd: 'SET_HEADING', payload: 'h3', previewText: 'AaBbCcDd', subLabel: 'Heading 3', fontSize: 13, bold: true, italic: false },
  { id: 'quote', label: 'Quote', cmd: 'SET_QUOTE', previewText: 'AaBbCcDd', subLabel: 'Quote', fontSize: 13, bold: false, italic: true },
];

export function renderParaStylePanelCodeSnippet({
  PARA_STYLES,
  selectionState,
  cmd,
  setSubPanel,
  themeColors,
}: any) {
  const { blue, textPri, textSec, border, surface } = themeColors;
  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 }}>
        {PARA_STYLES.map((style: any) => {
          const isActive = selectionState.blockType === style.id;
          return (
            <TouchableOpacity
              key={style.id}
              style={{
                width: '47%',
                minHeight: 70,
                borderWidth: 1.5,
                borderRadius: 8,
                borderColor: isActive ? blue : border,
                backgroundColor: isActive ? blue + '0D' : surface,
                padding: 10,
                gap: 4,
                position: 'relative',
              }}
              onPress={() => { (style as any).payload ? cmd(style.cmd, (style as any).payload) : cmd(style.cmd); setSubPanel('none'); }}
            >
              <Text style={{
                fontSize: style.fontSize,
                fontWeight: style.bold ? '700' : '400',
                fontStyle: style.italic ? 'italic' : 'normal',
                color: isActive ? blue : textPri,
                textAlign: 'left',
              }} numberOfLines={2}>
                {style.previewText}
              </Text>
              <Text style={{ fontSize: 11, color: isActive ? blue : textSec }}>{style.subLabel}</Text>
              {isActive && (
                <View style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: blue }}>
                  <MaterialIcons name="check" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
