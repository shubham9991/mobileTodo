/**
 * BACKUP OF REMOVED FEATURE: Lexical Pagination Plugin
 * Removed on request to simplify the app and reduce bundle size.
 *
 * This plugin handles:
 *  - Page size aspects ratios
 *  - Margins calculations
 *  - Orientation calculations
 *  - Dynamic page height, page break element injection (`data-page-start`)
 *  - Listening to DOM attribute mutations (data-page-size, data-page-orientation, data-page-margins)
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

export function PaginationPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const updatePagination = () => {
      const rootEl = editor.getRootElement();
      if (!rootEl) return;

      const pageSize = document.documentElement.getAttribute('data-page-size') || 'pageless';
      const orientation = document.documentElement.getAttribute('data-page-orientation') || 'portrait';
      const marginAttr = document.documentElement.getAttribute('data-page-margins') || 'normal';

      const children = Array.from(rootEl.children) as HTMLElement[];

      // Clear all page starts first
      children.forEach(child => {
        child.removeAttribute('data-page-start');
      });

      if (pageSize === 'pageless') return;

      const width = rootEl.clientWidth;

      // Aspect ratios map
      const ASPECT_RATIOS: Record<string, number> = {
        a4: 1.414,
        letter: 1.294,
        legal: 1.647,
        tabloid: 1.545,
        a3: 1.414,
        a5: 1.414,
        b4: 1.412,
        b5: 1.420,
        statement: 1.545,
        executive: 1.448,
        folio: 1.529,
      };

      const ratio = ASPECT_RATIOS[pageSize] || 1.414;
      const heightMultiplier = orientation === 'portrait' ? ratio : 1 / ratio;

      // Calculate total page height based on viewport size
      const totalPageHeight = width * heightMultiplier;

      // Subtract padding to find the printable height
      const marginMap: Record<string, number> = { narrow: 32, normal: 56, moderate: 80, wide: 104 };
      const totalPadding = marginMap[marginAttr] || 56;
      const printableHeight = totalPageHeight - totalPadding;

      let cumulativeHeight = 0;
      let pageCount = 1;

      children.forEach((child) => {
        // Skip editor action bar or helper elements that are absolutely positioned
        if (child.classList.contains('code-action-bar') || child.tagName === 'BUTTON') return;

        const childHeight = child.offsetHeight;
        cumulativeHeight += childHeight;

        // If this child element pushes the page past the printable height boundary
        if (cumulativeHeight > printableHeight) {
          child.setAttribute('data-page-start', 'true');
          // Reset count starting with this child's height on the new page
          cumulativeHeight = childHeight;
          pageCount++;
        }
      });

      // Dynamically size the editor-input container to always span full pages
      // total height = (number of pages * height of one page) + (number of gaps * gap height)
      const totalPageHeightWithGaps = (pageCount * totalPageHeight) + ((pageCount - 1) * 56);
      rootEl.style.minHeight = `${totalPageHeightWithGaps}px`;
    };

    // Run on editor updates (text changes, node insertions/deletions)
    const unregisterUpdate = editor.registerUpdateListener(() => {
      // Run after the DOM finishes updating
      setTimeout(updatePagination, 0);
    });

    // Run on window resize or orientation change
    window.addEventListener('resize', updatePagination, { passive: true });

    // Use ResizeObserver for accurate container size tracking
    const rootEl = editor.getRootElement();
    let ro: ResizeObserver | null = null;
    if (rootEl) {
      ro = new ResizeObserver(() => {
        updatePagination();
      });
      ro.observe(rootEl);
    }

    // Also run a MutationObserver on document.documentElement attributes
    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName && mutation.attributeName.startsWith('data-page-')) {
          updatePagination();
          break;
        }
      }
    });
    mo.observe(document.documentElement, { attributes: true });

    // Initial run
    updatePagination();

    return () => {
      unregisterUpdate();
      window.removeEventListener('resize', updatePagination);
      if (ro) ro.disconnect();
      mo.disconnect();
    };
  }, [editor]);

  return null;
}
