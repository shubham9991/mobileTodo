/**
 * Central node registry — import this single file in App.tsx initialConfig.
 * Add every custom node here so Lexical can deserialize JSON AST correctly.
 */
import { Klass, LexicalNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { HashtagNode } from '@lexical/hashtag';
import { OverflowNode } from '@lexical/overflow';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { MarkNode } from '@lexical/mark';
import { ImageNode } from './ImageNode';
import { YouTubeNode } from './YouTubeNode';
import { EquationNode } from './EquationNode';
import {
  CollapsibleContainerNode,
  CollapsibleTitleNode,
  CollapsibleContentNode,
} from './CollapsibleNodes';
import { PollNode } from './PollNode';
import { PageBreakNode } from './PageBreakNode';
import { TweetCardNode } from './TweetCardNode';
import { LinkPreviewNode } from './LinkPreviewNode';
import { KeepChecklistNode } from './KeepChecklistNode';

export const allNodes: Array<Klass<LexicalNode>> = [
  // Built-in rich text
  HeadingNode,
  QuoteNode,
  // Lists
  ListNode,
  ListItemNode,
  // Links
  LinkNode,
  AutoLinkNode,
  // Code
  CodeNode,
  CodeHighlightNode,
  // Table
  TableNode,
  TableCellNode,
  TableRowNode,
  // Utility
  HashtagNode,
  OverflowNode,
  HorizontalRuleNode,
  MarkNode,
  // Custom
  ImageNode,
  YouTubeNode,
  EquationNode,
  CollapsibleContainerNode,
  CollapsibleTitleNode,
  CollapsibleContentNode,
  PollNode,
  PageBreakNode,
  TweetCardNode,
  LinkPreviewNode,
  KeepChecklistNode,
];

export * from './ImageNode';
export * from './YouTubeNode';
export * from './EquationNode';
export * from './CollapsibleNodes';
export * from './PollNode';
export * from './PageBreakNode';
export * from './TweetCardNode';
export * from './LinkPreviewNode';
export * from './KeepChecklistNode';
