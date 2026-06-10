/**
 * PollNode — A Lexical DecoratorNode that renders an interactive poll.
 *
 * Stores: question, options (label), votes per option (userId set).
 * All state is serialized into Lexical JSON AST → persists with the note.
 */
import React, { useState } from 'react';
import {
  DecoratorNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  LexicalNode,
} from 'lexical';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PollOption = {
  uid: string;   // stable ID
  text: string;
  votes: string[]; // array of voter UIDs
};

export type SerializedPollNode = Spread<{
  question: string;
  options: PollOption[];
  voterId: string;
  multiSelect: boolean;
}, SerializedLexicalNode>;

// ── Deterministic small ID ────────────────────────────────────────────────────
function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ── React Component ───────────────────────────────────────────────────────────
function PollComponent({
  question: initialQuestion,
  options: initialOptions,
  voterId,
  multiSelect,
  onChange,
}: {
  question: string;
  options: PollOption[];
  voterId: string;
  multiSelect: boolean;
  onChange: (q: string, opts: PollOption[]) => void;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [options, setOptions] = useState<PollOption[]>(initialOptions);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const totalVotes = options.reduce((s, o) => s + o.votes.length, 0);
  const myVotes = options.filter(o => o.votes.includes(voterId)).map(o => o.uid);
  const hasVoted = myVotes.length > 0;

  const vote = (optUid: string) => {
    setOptions(prev => {
      const next = prev.map(o => {
        const alreadyVoted = o.votes.includes(voterId);
        if (multiSelect) {
          if (o.uid === optUid) {
            return { ...o, votes: alreadyVoted ? o.votes.filter(v => v !== voterId) : [...o.votes, voterId] };
          }
          return o;
        } else {
          // single choice — remove from others, toggle on selected
          if (o.uid === optUid) {
            return { ...o, votes: alreadyVoted ? o.votes.filter(v => v !== voterId) : [...o.votes, voterId] };
          }
          return { ...o, votes: o.votes.filter(v => v !== voterId) };
        }
      });
      onChange(question, next);
      return next;
    });
  };

  const updateOption = (idx: number, text: string) => {
    setOptions(prev => {
      const next = prev.map((o, i) => i === idx ? { ...o, text } : o);
      onChange(question, next);
      return next;
    });
  };

  const addOption = () => {
    setOptions(prev => {
      const next = [...prev, { uid: uid(), text: '', votes: [] }];
      onChange(question, next);
      return next;
    });
    setEditingIdx(options.length);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    setOptions(prev => {
      const next = prev.filter((_, i) => i !== idx);
      onChange(question, next);
      return next;
    });
  };

  const updateQuestion = (q: string) => {
    setQuestion(q);
    onChange(q, options);
  };

  return (
    <div className="poll-container" contentEditable={false}>
      {/* Question */}
      <div className="poll-header">
        <span className="poll-icon">📊</span>
        <input
          className="poll-question-input"
          placeholder="Poll question…"
          value={question}
          onChange={e => updateQuestion(e.target.value)}
        />
      </div>

      {/* Options */}
      <div className="poll-options">
        {options.map((opt, idx) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
          const voted = opt.votes.includes(voterId);
          return (
            <div key={opt.uid} className={`poll-option ${voted ? 'poll-option-voted' : ''}`}>
              {/* Result bar */}
              <div className="poll-bar" style={{ width: `${pct}%` }} />

              {/* Option content */}
              <div className="poll-option-inner">
                {/* Vote button */}
                <button
                  className={`poll-vote-btn ${voted ? 'poll-vote-btn-active' : ''}`}
                  onClick={() => vote(opt.uid)}
                  title={voted ? 'Remove vote' : 'Vote'}
                >
                  {voted ? '✓' : '○'}
                </button>

                {/* Label */}
                {editingIdx === idx ? (
                  <input
                    className="poll-option-input"
                    autoFocus
                    value={opt.text}
                    placeholder={`Option ${idx + 1}`}
                    onChange={e => updateOption(idx, e.target.value)}
                    onBlur={() => setEditingIdx(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setEditingIdx(null); }}
                  />
                ) : (
                  <span
                    className="poll-option-label"
                    onClick={() => setEditingIdx(idx)}
                  >
                    {opt.text || `Option ${idx + 1}`}
                  </span>
                )}

                {/* Vote count + pct */}
                <span className="poll-option-pct">{pct}%</span>

                {/* Remove button */}
                {options.length > 2 && (
                  <button
                    className="poll-remove-btn"
                    onClick={() => removeOption(idx)}
                    title="Remove option"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="poll-footer">
        <button className="poll-add-btn" onClick={addOption}>+ Add option</button>
        <span className="poll-total">
          {totalVotes} vote{totalVotes !== 1 ? 's' : ''}
          {multiSelect && <span className="poll-multi-badge"> · Multi-select</span>}
        </span>
      </div>
    </div>
  );
}

// ── Lexical Node ──────────────────────────────────────────────────────────────
export class PollNode extends DecoratorNode<React.ReactElement> {
  __question: string;
  __options: PollOption[];
  __voterId: string;
  __multiSelect: boolean;

  static getType(): string { return 'poll'; }

  static clone(node: PollNode): PollNode {
    return new PollNode(node.__question, node.__options, node.__voterId, node.__multiSelect, node.__key);
  }

  constructor(
    question: string,
    options: PollOption[],
    voterId: string,
    multiSelect: boolean,
    key?: NodeKey,
  ) {
    super(key);
    this.__question = question;
    this.__options = options;
    this.__voterId = voterId;
    this.__multiSelect = multiSelect;
  }

  static importJSON(data: SerializedPollNode): PollNode {
    return new PollNode(data.question, data.options, data.voterId, data.multiSelect);
  }

  exportJSON(): SerializedPollNode {
    return {
      type: 'poll',
      version: 1,
      question: this.__question,
      options: this.__options,
      voterId: this.__voterId,
      multiSelect: this.__multiSelect,
    };
  }

  createDOM(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'poll-wrapper';
    return div;
  }

  updateDOM(): boolean { return false; }

  isInline(): boolean { return false; }

  isIsolated(): boolean { return true; }

  decorate(editor: import('lexical').LexicalEditor): React.ReactElement {
    const handleChange = (q: string, opts: PollOption[]) => {
      editor.update(() => {
        const writable = this.getWritable();
        writable.__question = q;
        writable.__options = opts;
      });
    };
    return (
      <PollComponent
        question={this.__question}
        options={this.__options}
        voterId={this.__voterId}
        multiSelect={this.__multiSelect}
        onChange={handleChange}
      />
    );
  }
}

export function $createPollNode(): PollNode {
  const voterId = uid();
  return new PollNode('', [
    { uid: uid(), text: '', votes: [] },
    { uid: uid(), text: '', votes: [] },
  ], voterId, false);
}

export function $isPollNode(node: LexicalNode | null | undefined): node is PollNode {
  return node instanceof PollNode;
}
