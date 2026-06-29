import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tldraw,
  type Editor,
  type TLUiOverrides,
  type TLUiActionsContextType,
  createTLStore,
  defaultShapeUtils,
  defaultBindingUtils,
} from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';

// ─── React Native WebView bridge type ─────────────────────────────────────────
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (msg: string) => void;
    };
  }
}

// ─── Post a message back to React Native ──────────────────────────────────────
function postToRN(type: string, payload?: unknown) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type, payload }));
}

// ─── Debounce helper ──────────────────────────────────────────────────────────
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

// ─── Custom UI overrides — hide menus we don't need in mobile ─────────────────
const uiOverrides: TLUiOverrides = {
  actions(_editor: Editor, actions: TLUiActionsContextType) {
    return actions;
  },
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const editorRef = useRef<Editor | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isReady, setIsReady] = useState(false);

  // ── Save snapshot to RN (debounced 1.5s) ─────────────────────────────────
  const saveToRN = useCallback(
    debounce(async (editor: Editor) => {
      try {
        const snapshot = editor.store.getSnapshot();
        postToRN('SAVE', JSON.stringify(snapshot));

        // Generate thumbnail via canvas export
        const shapeIds = editor.getCurrentPageShapeIds();
        if (shapeIds.size === 0) {
          postToRN('THUMBNAIL', null);
          return;
        }

        const blob = await editor.toBlob({ ids: [...shapeIds], format: 'png', scale: 0.4 });
        if (!blob) return;

        const reader = new FileReader();
        reader.onloadend = () => {
          postToRN('THUMBNAIL', reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error('[tldraw] save error', err);
      }
    }, 1500),
    []
  );

  // ── Listen for commands from React Native ─────────────────────────────────
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let data: { type: string; payload?: string };
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      const editor = editorRef.current;

      switch (data.type) {
        case 'LOAD_STATE': {
          if (!editor || !data.payload) break;
          try {
            const snapshot = JSON.parse(data.payload);
            editor.store.loadSnapshot(snapshot);
            // Zoom to fit after loading
            setTimeout(() => editor.zoomToFit({ animation: { duration: 400 } }), 100);
          } catch (err) {
            console.error('[tldraw] LOAD_STATE error', err);
          }
          break;
        }
        case 'SET_THEME': {
          setTheme(data.payload === 'dark' ? 'dark' : 'light');
          break;
        }
        case 'CLEAR_CANVAS': {
          if (!editor) break;
          editor.selectAll();
          editor.deleteShapes(editor.getSelectedShapeIds());
          break;
        }
        case 'UNDO': {
          editor?.undo();
          break;
        }
        case 'REDO': {
          editor?.redo();
          break;
        }
        case 'ZOOM_TO_FIT': {
          editor?.zoomToFit({ animation: { duration: 400 } });
          break;
        }
        case 'EXPORT_PNG': {
          if (!editor) break;
          (async () => {
            try {
              const shapeIds = editor.getCurrentPageShapeIds();
              if (shapeIds.size === 0) { postToRN('EXPORT_RESULT', null); return; }
              const blob = await editor.toBlob({ ids: [...shapeIds], format: 'png', scale: 2 });
              if (!blob) { postToRN('EXPORT_RESULT', null); return; }
              const reader = new FileReader();
              reader.onloadend = () => postToRN('EXPORT_RESULT', reader.result as string);
              reader.readAsDataURL(blob);
            } catch (err) {
              console.error('[tldraw] EXPORT_PNG error', err);
              postToRN('EXPORT_RESULT', null);
            }
          })();
          break;
        }
      }
    };

    // Android WebView uses window.addEventListener('message', ...)
    window.addEventListener('message', handleMessage);
    // iOS WKWebView also uses this but via window.onmessage
    document.addEventListener('message', handleMessage as EventListener);

    // ── Intercept ALL download anchor clicks ──────────────────────────────
    // WebView cannot trigger browser downloads. We catch every <a download>
    // click, extract the href (data URL or blob URL), convert to base64 if
    // needed, then postMessage to React Native which handles saving/sharing.
    const handleDownloadClick = (e: MouseEvent) => {
      const anchor = (e.target as Element)?.closest('a[download]') as HTMLAnchorElement | null;
      if (!anchor) return;

      e.preventDefault();
      e.stopPropagation();

      const href = anchor.href;
      const filename = anchor.download || 'image.png';

      if (href.startsWith('data:')) {
        // Already a base64 data URL — send directly
        postToRN('DOWNLOAD_FILE', JSON.stringify({ dataUrl: href, filename }));
      } else if (href.startsWith('blob:')) {
        // Blob URL — convert to base64 first via FileReader
        fetch(href)
          .then(r => r.blob())
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
              postToRN('DOWNLOAD_FILE', JSON.stringify({
                dataUrl: reader.result as string,
                filename,
              }));
            };
            reader.readAsDataURL(blob);
          })
          .catch(err => console.error('[tldraw] download blob error', err));
      } else {
        // Fallback: send the URL and let RN fetch it
        postToRN('DOWNLOAD_FILE', JSON.stringify({ url: href, filename }));
      }
    };

    // Use capture phase so we intercept before tldraw's own handlers
    document.addEventListener('click', handleDownloadClick, true);

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('message', handleMessage as EventListener);
      document.removeEventListener('click', handleDownloadClick, true);
    };
  }, []);

  // ── Signal ready to React Native once mounted ─────────────────────────────
  useEffect(() => {
    if (isReady) {
      postToRN('READY');
    }
  }, [isReady]);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Listen to store changes — trigger debounced save
    editor.store.listen(
      () => {
        saveToRN(editor);
      },
      { scope: 'document', source: 'user' }
    );

    setIsReady(true);
  }, [saveToRN]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        // Prevent rubber-band scroll on mobile which fights tldraw's gestures
        overflow: 'hidden',
        touchAction: 'none',
      }}
    >
      <Tldraw
        onMount={handleMount}
        // Force tldraw to use our theme
        forceMobile
        overrides={uiOverrides}
        // Hide the "Share" menu button we don't need
        hideUi={false}
      />

      {/* Inject theme class into tldraw's root DOM element */}
      <style>{`
        .tl-theme__light {
          --tl-background: #ffffff;
        }
        .tl-theme__dark {
          --tl-background: #1a1a2e;
        }
        /* Mobile-friendly: make toolbar items slightly bigger for touch */
        .tlui-toolbar__inner {
          gap: 2px;
        }
        /* Make sure tldraw fills the full screen */
        .tl-container {
          width: 100% !important;
          height: 100% !important;
        }
        /* ── Nuclear watermark removal ────────────────────────────────────────
           The tldraw watermark is a vertical "TLDRAW" text badge on the right
           edge. Target every known class name + any anchor pointing to tldraw */
        .tl-watermark,
        .tlui-watermark,
        .tlui-watermark__link,
        [class*="watermark"],
        [class*="Watermark"],
        .tlui-help-menu,
        [class*="helpMenu"],
        [class*="HelpMenu"],
        [data-testid="watermark"],
        [data-testid="help-menu"],
        a[href*="tldraw"],
        a[href*="tldraw.com"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
          overflow: hidden !important;
        }
      `}</style>

      {/* Apply theme via data attribute */}
      <script dangerouslySetInnerHTML={{
        __html: `
          (function() {
            var el = document.querySelector('.tl-container');
            if (el) el.setAttribute('data-color-mode', '${theme}');

            // Material Design "share" icon path
            var SHARE_SVG_PATH = 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z';

            function swapDownloadToShare() {
              // Find every button whose aria-label contains "download" (case-insensitive)
              document.querySelectorAll('button').forEach(function(btn) {
                var label = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
                if (label.indexOf('download') === -1) return;
                if (btn.dataset.shareSwapped) return; // already done

                // Mark so we don't re-process
                btn.dataset.shareSwapped = '1';

                // Find the SVG inside and replace its path data
                var svg = btn.querySelector('svg');
                if (svg) {
                  var path = svg.querySelector('path');
                  if (path) {
                    path.setAttribute('d', SHARE_SVG_PATH);
                  } else {
                    // Build a fresh path element
                    var newPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    newPath.setAttribute('d', SHARE_SVG_PATH);
                    newPath.setAttribute('fill', 'currentColor');
                    svg.appendChild(newPath);
                  }
                  // Fix viewBox if needed so the icon renders correctly
                  if (!svg.getAttribute('viewBox')) {
                    svg.setAttribute('viewBox', '0 0 24 24');
                  }
                }
              });
            }

            // Continuously nuke any watermark elements + swap download→share icon
            var observer = new MutationObserver(function() {
              var selectors = [
                '.tl-watermark', '.tlui-watermark', '.tlui-watermark__link',
                '[class*="watermark"]', '[class*="Watermark"]',
                '.tlui-help-menu', 'a[href*="tldraw"]'
              ];
              selectors.forEach(function(sel) {
                document.querySelectorAll(sel).forEach(function(el) {
                  el.style.setProperty('display', 'none', 'important');
                  el.style.setProperty('visibility', 'hidden', 'important');
                  el.style.setProperty('opacity', '0', 'important');
                });
              });
              swapDownloadToShare();
            });
            observer.observe(document.body || document.documentElement, {
              childList: true,
              subtree: true
            });
          })();
        `
      }} />
    </div>
  );
}
