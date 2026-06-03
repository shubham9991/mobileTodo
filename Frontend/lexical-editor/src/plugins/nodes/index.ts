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
];
