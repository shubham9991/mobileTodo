/**
 * CodeActionMenuPlugin — command handler for code block actions.
 * All visual UI (language selector, copy, download) is handled by the
 * native NoteToolbar. This plugin only processes those commands from RN.
 */
import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $isCodeNode, CodeNode } from '@lexical/code';
import { $getSelection, $isRangeSelection } from 'lexical';

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  css: 'css',
  html: 'html',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  go: 'go',
  rust: 'rs',
  sql: 'sql',
  swift: 'swift',
  markdown: 'md',
  powershell: 'ps1',
  objectivec: 'm',
  xml: 'xml',
  plaintext: 'txt',
  '': 'txt',
};

function getCodeContent(editor: any, codeNodeKey: string): string {
  let content = '';
  editor.getEditorState().read(() => {
    const node = editor.getEditorState()._nodeMap.get(codeNodeKey);
    if ($isCodeNode(node)) {
      content = node.getTextContent();
    }
  });
  return content;
}

function getActiveCodeNode(editor: any): { node: CodeNode; key: string } | null {
  let result: { node: CodeNode; key: string } | null = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const anchorNode = selection.anchor.getNode();
    const codeNode = anchorNode.getParents().find($isCodeNode) ||
                     ($isCodeNode(anchorNode) ? anchorNode : null);
    if (codeNode) {
      result = { node: codeNode as CodeNode, key: (codeNode as any).getKey() };
    }
  });
  return result;
}

export default function CodeActionMenuPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Listen for COPY_CODE and DOWNLOAD_CODE commands dispatched from App.tsx
    // These are handled there via the bridge; this plugin is now a no-op visual renderer.
    // Keeping file for potential future extension.
  }, [editor]);

  return null;
}
