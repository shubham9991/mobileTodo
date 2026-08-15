# Removed Features: Notes Editor & Formatting Tools

This directory contains preserved source code for features removed from the Notes module to simplify the UI, streamline workflows, and reduce app bundle size.

---

## Contents

1. **`LayoutToolbarFeature.tsx`**:
   - `PAGE_SIZES` constant list (Pageless, A4, Letter, Legal, Tabloid, A3, etc.).
   - `MARGIN_OPTIONS` constant list (Narrow, Normal, Moderate, Wide).
   - `LINE_SPACINGS` constant list (Single, 1.15, 1.5, Double, etc.).
   - `usePageLayout` hook and Layout sub-panel renderers.

2. **`PaginationPlugin.tsx` & `layoutStyles.css`**:
   - Lexical editor pagination engine and sheet layout CSS.

3. **`InsertToolsBackup.tsx`**:
   - Manual modal dialogs and buttons for YouTube embeds, Twitter/X embeds, Hyperlinks, LaTeX Equations, and Date insertion.
   - Replaced by automatic link preview and embedding on paste.

4. **`SlashCommandBackup.tsx`**:
   - Native React Native `/` Slash Command bottom sheet menu (`SlashCommandMenu.tsx`).
   - Lexical editor `SlashCommandPlugin` (detects `/` keypress at start of line/word, Esc key, and bridge events).

5. **`HomeFormattingToolsBackup.tsx`**:
   - **Font Size**: `FONT_SIZES` list, `fontSize` sub-panel, and stepper controls.
   - **Change Case**: `renderTextTransformPanel` (Uppercase, Lowercase, Capitalize).
   - **Styles**: `PARA_STYLES` list and `renderParaStylePanel` with Word-style text preview cards.

6. **`LinkEmbedCardsBackup.tsx`**:
   - `AutoEmbedPlugin` and node creators for converting pasted URLs into visual preview cards and embed players.
   - Replaced by Google Keep style clean inline text hyperlinks with a floating action bubble (Open, Copy, Remove).

---

## How to Restore

- **Slash Menu**: Re-add `SlashCommandPlugin` in `lexical-editor/src/App.tsx` and `<SlashCommandMenu />` in `NoteEditor.tsx`.
- **Font Size / Change Case / Styles**: Import snippets from `HomeFormattingToolsBackup.tsx` into `NoteToolbar.tsx`.
- **Layout / Page Sizes**: Follow instructions in `LayoutToolbarFeature.tsx` & `PaginationPlugin.tsx`.
