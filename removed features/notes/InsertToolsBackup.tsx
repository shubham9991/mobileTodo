/**
 * BACKUP OF REMOVED FEATURE: Manual Insert Tools
 * (YouTube Modal, Twitter/X Modal, Hyperlink Modal, LaTeX Equation Modal, Insert Date)
 *
 * Removed from the Insert tab in favor of automatic paste embedding:
 * Pasting any YouTube, Twitter / X, or website URL now automatically converts
 * into a rich interactive preview card directly inside the editor.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Insert Tab Groups (Original Structure with all manual tools) ─────────────

export function getOriginalInsertGroups({
  cmd,
  setShowYouTubeModal,
  setShowTweetModal,
  setShowTableModal,
  setShowLinkModal,
  setShowEquationModal,
}: any) {
  return [
    {
      title: 'Media',
      items: [
        { icon: 'image', label: 'Image', desc: 'Insert from library', color: '#10B981', onPress: () => cmd('INSERT_IMAGE_NATIVE') },
        { icon: 'play-circle-outline', label: 'YouTube', desc: 'Embed a video', color: '#EF4444', onPress: () => setShowYouTubeModal(true) },
        { icon: 'alternate-email', label: 'Tweet / X', desc: 'Embed a post', color: '#1D9BF0', onPress: () => setShowTweetModal(true) },
      ],
    },
    {
      title: 'Structure',
      items: [
        { icon: 'table-chart', label: 'Table', desc: 'Insert a table', color: '#6366F1', onPress: () => setShowTableModal(true) },
        { icon: 'poll', label: 'Poll', desc: 'Add a poll block', color: '#F59E0B', onPress: () => cmd('INSERT_POLL') },
        { icon: 'expand-more', label: 'Collapsible', desc: 'Collapsible section', color: '#8B5CF6', onPress: () => cmd('INSERT_COLLAPSIBLE') },
      ],
    },
    {
      title: 'Tools',
      items: [
        { icon: 'link', label: 'Link', desc: 'Insert a hyperlink', color: '#3B82F6', onPress: () => setShowLinkModal(true) },
        { icon: 'functions', label: 'Equation', desc: 'LaTeX math block', color: '#EC4899', onPress: () => setShowEquationModal(true) },
        {
          icon: 'today',
          label: 'Date',
          desc: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          color: '#06B6D4',
          onPress: () => cmd('INSERT_DATE', new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })),
        },
      ],
    },
    {
      title: 'Dividers',
      items: [
        { icon: 'horizontal-rule', label: 'Horizontal Rule', desc: 'Thin divider line', color: '#6B7280', onPress: () => cmd('INSERT_HR') },
        { icon: 'insert-page-break', label: 'Page Break', desc: 'Force a page break', color: '#6B7280', onPress: () => cmd('INSERT_PAGE_BREAK') },
      ],
    },
  ];
}

// ─── Modal State & Handlers ──────────────────────────────────────────────────

export function useManualInsertModals(cmd: (type: string, payload?: string) => void) {
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState(false);
  const [showEquationModal, setShowEquationModal] = useState(false);
  const [showTweetModal, setShowTweetModal] = useState(false);

  const [linkUrl, setLinkUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [equation, setEquation] = useState('');
  const [tweetUrl, setTweetUrl] = useState('');

  const extractYouTubeId = (url: string): string | null => {
    const m = url.match(
      /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
  };

  const handleInsertLink = () => {
    cmd('TOGGLE_LINK', linkUrl);
    setLinkUrl('');
    setShowLinkModal(false);
  };

  const handleInsertYouTube = () => {
    const id = extractYouTubeId(youtubeUrl);
    if (id) {
      cmd('INSERT_YOUTUBE', id);
      setYoutubeUrl('');
      setShowYouTubeModal(false);
    }
  };

  const handleInsertTweet = () => {
    cmd('INSERT_TWEET', tweetUrl);
    setTweetUrl('');
    setShowTweetModal(false);
  };

  const handleInsertEquation = () => {
    cmd('INSERT_EQUATION', JSON.stringify({ equation, inline: false }));
    setEquation('');
    setShowEquationModal(false);
  };

  return {
    showLinkModal, setShowLinkModal, linkUrl, setLinkUrl, handleInsertLink,
    showYouTubeModal, setShowYouTubeModal, youtubeUrl, setYoutubeUrl, handleInsertYouTube,
    showTweetModal, setShowTweetModal, tweetUrl, setTweetUrl, handleInsertTweet,
    showEquationModal, setShowEquationModal, equation, setEquation, handleInsertEquation,
    extractYouTubeId,
  };
}
