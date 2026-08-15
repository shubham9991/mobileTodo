/**
 * BACKUP OF REMOVED FEATURE: Visual Link Preview Cards & Embed Players
 * (AutoEmbedPlugin, YouTubeNode, TweetCardNode, LinkPreviewNode)
 *
 * Removed in favor of Google Keep style clean inline text links with a
 * floating action bubble (Open, Copy, Unlink) when tapped.
 */

import React, { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $getRoot, $getNodeByKey } from 'lexical';

const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const TWITTER_REGEX = /(?:twitter\.com|x\.com)\/\S+\/status\/\d+/;
const GENERIC_URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

export function AutoEmbedPlugin({
  $createYouTubeNode,
  $createTweetCardNode,
  $createLinkPreviewNode,
}: any): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // ── Method 1: intercept paste event ──
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (!text) return;

      const ytMatch = text.match(YT_REGEX);
      if (ytMatch && $createYouTubeNode) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const videoID = ytMatch[1];
        editor.update(() => {
          const sel = $getSelection();
          if (sel) sel.insertNodes([$createYouTubeNode(videoID)]);
        });
        return;
      }

      if (TWITTER_REGEX.test(text) && $createTweetCardNode) {
        e.preventDefault();
        e.stopImmediatePropagation();
        editor.update(() => {
          const sel = $getSelection();
          if (sel) sel.insertNodes([$createTweetCardNode(text)]);
        });
        return;
      }

      if (GENERIC_URL_REGEX.test(text) && $createLinkPreviewNode) {
        e.preventDefault();
        e.stopImmediatePropagation();
        editor.update(() => {
          const sel = $getSelection();
          if (sel) sel.insertNodes([$createLinkPreviewNode(text)]);
        });
      }
    };

    const pasteCleanup = editor.registerRootListener((root, prevRoot) => {
      if (prevRoot) prevRoot.removeEventListener('paste', onPaste, true);
      if (root) root.addEventListener('paste', onPaste, true);
    });

    // ── Method 2: scan paragraphs after every update ──
    let converting = false;
    const updateCleanup = editor.registerUpdateListener(({ editorState, dirtyLeaves }) => {
      if (converting || dirtyLeaves.size === 0) return;

      editorState.read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        for (const child of children) {
          if (child.getType() !== 'paragraph') continue;
          const text = child.getTextContent().trim();
          if (!text) continue;

          const ytMatch = text.match(YT_REGEX);
          if (ytMatch && $createYouTubeNode) {
            const videoID = ytMatch[1];
            converting = true;
            editor.update(() => {
              const fresh = $getNodeByKey(child.getKey());
              if (fresh && fresh.getType() === 'paragraph' && fresh.getTextContent().trim() === text) {
                const embed = $createYouTubeNode(videoID);
                fresh.replace(embed);
              }
            }, { onUpdate: () => { converting = false; } });
            return;
          }

          if (TWITTER_REGEX.test(text) && $createTweetCardNode) {
            converting = true;
            editor.update(() => {
              const fresh = $getNodeByKey(child.getKey());
              if (fresh && fresh.getType() === 'paragraph' && fresh.getTextContent().trim() === text) {
                const embed = $createTweetCardNode(text);
                fresh.replace(embed);
              }
            }, { onUpdate: () => { converting = false; } });
            return;
          }

          if (GENERIC_URL_REGEX.test(text) && $createLinkPreviewNode) {
            converting = true;
            editor.update(() => {
              const fresh = $getNodeByKey(child.getKey());
              if (fresh && fresh.getType() === 'paragraph' && fresh.getTextContent().trim() === text) {
                const embed = $createLinkPreviewNode(text);
                fresh.replace(embed);
              }
            }, { onUpdate: () => { converting = false; } });
            return;
          }
        }
      });
    });

    return () => {
      pasteCleanup();
      updateCleanup();
    };
  }, [editor, $createYouTubeNode, $createTweetCardNode, $createLinkPreviewNode]);

  return null;
}
