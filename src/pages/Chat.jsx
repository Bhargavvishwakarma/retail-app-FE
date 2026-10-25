import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';

function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function splitMarkdownTableRow(line) {
  const row = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return row.split('|').map(cell => cell.trim());
}

function isMarkdownTableStart(lines, index) {
  if (index + 1 >= lines.length || !lines[index].includes('|')) return false;
  const separators = splitMarkdownTableRow(lines[index + 1]);
  return separators.length > 1 && separators.every(cell => /^:?-{3,}:?$/.test(cell));
}

function MarkdownAnswer({ content }) {
  const lines = content.split(/\r?\n/);
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (isMarkdownTableStart(lines, index)) {
      const headers = splitMarkdownTableRow(lines[index]);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(splitMarkdownTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div className="chat-markdown-table-wrap" key={`table-${index}`}>
          <table className="chat-markdown-table">
            <thead><tr>{headers.map((cell, cellIndex) => <th key={`header-${cellIndex}`}>{renderInline(cell, `header-${index}-${cellIndex}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={`row-${rowIndex}`}>
              {headers.map((_, cellIndex) => <td key={`cell-${cellIndex}`}>{renderInline(row[cellIndex] || '', `cell-${index}-${rowIndex}-${cellIndex}`)}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.trim().startsWith('```')) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith('```')) codeLines.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<pre key={`code-${index}`}><code>{codeLines.join('\n')}</code></pre>);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
    if (heading) {
      const Heading = `h${heading[1].length + 2}`;
      blocks.push(<Heading key={`heading-${index}`}>{renderInline(heading[2], `heading-${index}`)}</Heading>);
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const List = isOrdered ? 'ol' : 'ul';
      const items = [];
      while (index < lines.length) {
        const item = isOrdered
          ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/)
          : lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!item) break;
        items.push(<li key={`item-${index}`}>{renderInline(item[1], `item-${index}`)}</li>);
        index += 1;
      }
      blocks.push(<List key={`list-${index}`}>{items}</List>);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() &&
      !/^\s{0,3}#{1,3}\s+/.test(lines[index]) &&
      !isMarkdownTableStart(lines, index) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+[.)]\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith('```')) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{renderInline(paragraph.join(' '), `paragraph-${index}`)}</p>);
  }

  return <div className="chat-answer-content">{blocks}</div>;
}

function getErrorMessage(error) {
  const status = error.response?.status;
  const problem = error.response?.data;
  const detail = problem?.detail || problem?.message || problem?.error;
  if (typeof detail === 'string' && detail.trim()) {
    const requestId = problem?.requestId;
    return requestId ? `${detail} (Request ID: ${requestId})` : detail;
  }

  if (status === 401) return 'Your session has expired. Sign in again to continue.';
  if (status === 403) return 'You are not authorized to use retailer chat.';
  if (status === 400) return 'The selected model is invalid or unavailable. Choose another model and try again.';
  if (status === 503) return 'The chat service is currently unavailable. Please try again shortly.';
  if (status === 504) return 'The chat request timed out. Please try again.';

  return 'Chat could not be completed. Please try again.';
}

function formatConversationDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getSavedConversationId(storageKey) {
  try { return sessionStorage.getItem(storageKey) || ''; }
  catch { return ''; }
}

export default function Chat() {
  const { user } = useAuth();
  const draftKey = user.id || user.email || 'current-user';
  const conversationStorageKey = `retail-chat-conversation:${encodeURIComponent(draftKey)}`;
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useSessionState(`retail-draft:${draftKey}:chat-model`, '');
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState('');
  const [question, setQuestion] = useSessionState(`retail-draft:${draftKey}:chat-question`, '');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState('');
  const [sendError, setSendError] = useState('');
  const [conversationId, setConversationId] = useState(() => getSavedConversationId(conversationStorageKey));
  const [conversationRestoring, setConversationRestoring] = useState(() => Boolean(getSavedConversationId(conversationStorageKey)));
  const [conversations, setConversations] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const sendLock = useRef(false);
  const savedConversationOnMount = useRef(getSavedConversationId(conversationStorageKey));
  const latestMessageRef = useRef(null);
  const modelPickerRef = useRef(null);
  const historyPickerRef = useRef(null);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError('');
    try {
      const response = await api.get('/chat/models');
      const availableModels = Array.isArray(response.data) ? response.data : [];
      setModels(availableModels);
      setSelectedModelId(current => availableModels.some(model => model.id === current)
        ? current
        : (availableModels[0]?.id || ''));
    } catch (error) {
      setModels([]);
      setModelsError(getErrorMessage(error));
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  const loadConversations = useCallback(async (page = 0) => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const response = await api.get('/chat/conversations', { params: { page, size: 8 } });
      const data = response.data || {};
      setConversations(Array.isArray(data.content) ? data.content : []);
      setHistoryPage(Number.isInteger(data.page) ? data.page : page);
      setHistoryHasMore(Boolean(data.hasMore));
      setHistoryLoaded(true);
    } catch (error) {
      setHistoryError(getErrorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const openConversation = async id => {
    if (!id) return;
    setConversationRestoring(true);
    try {
      const response = await api.get(`/chat/conversations/${encodeURIComponent(id)}`);
      const detail = response.data || {};
      setConversationId(detail.conversation?.conversationId || id);
      setMessages((detail.messages || []).map((message, index) => ({
        id: `stored-${id}-${index}`,
        role: message.role,
        content: message.content,
        dataSources: message.dataSources || [],
      })));
      setSendError('');
      setHistoryOpen(false);
    } catch (error) {
      if (error.response?.status === 404) {
        if (conversationId === id) {
          setConversationId('');
          setMessages([]);
        }
        setSendError('This saved conversation is no longer available. Choose another chat or start a new one.');
      } else {
        setSendError(getErrorMessage(error));
      }
    }
    finally { setConversationRestoring(false); }
  };

  useEffect(() => {
    const id = savedConversationOnMount.current;
    if (id) openConversation(id);
  }, []);

  useEffect(() => {
    try {
      if (conversationId) sessionStorage.setItem(conversationStorageKey, conversationId);
      else sessionStorage.removeItem(conversationStorageKey);
    } catch { /* Session storage may be unavailable in restricted browsers. */ }
  }, [conversationId, conversationStorageKey]);

  const startNewConversation = () => {
    setConversationId('');
    setMessages([]);
    setQuestion('');
    setSendError('');
    setHistoryOpen(false);
  };

  useEffect(() => {
    if (!modelMenuOpen) return undefined;
    const closeOnOutsideClick = event => {
      if (!modelPickerRef.current?.contains(event.target)) setModelMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [modelMenuOpen]);

  useEffect(() => {
    if (!historyOpen) return undefined;
    const closeOnOutsideClick = event => {
      if (!historyPickerRef.current?.contains(event.target)) setHistoryOpen(false);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') setHistoryOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [historyOpen]);

  useEffect(() => {
    latestMessageRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages, sending]);

  const submitQuestion = async (prompt, clearComposer = false) => {
    const trimmedQuestion = prompt.trim();
    if (!trimmedQuestion || !selectedModelId || sendLock.current || sending) return;

    sendLock.current = true;
    setSending(true);
    setSendError('');
    if (clearComposer) setQuestion('');
    setMessages(previous => [...previous, {
      id: `question-${Date.now()}`,
      role: 'user',
      content: trimmedQuestion,
    }]);

    try {
      const payload = { question: trimmedQuestion, modelId: selectedModelId };
      if (conversationId) payload.conversationId = conversationId;
      const response = await api.post('/chat', payload);
      const data = response.data || {};
      if (data.conversationId) {
        setConversationId(data.conversationId);
        try { sessionStorage.setItem(conversationStorageKey, data.conversationId); }
        catch { /* Session storage may be unavailable in restricted browsers. */ }
      }
      await loadConversations(0);
      setMessages(previous => [...previous, {
        id: `answer-${Date.now()}`,
        role: 'assistant',
        content: typeof data.answer === 'string' ? data.answer : '',
        dataSources: Array.isArray(data.dataSources) ? data.dataSources : [],
      }]);
    } catch (error) {
      setSendError(getErrorMessage(error));
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  const sendMessage = event => {
    event.preventDefault();
    return submitQuestion(question, true);
  };

  const retryMessage = prompt => submitQuestion(prompt);

  const copyQuestion = async (messageId, prompt) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        const field = document.createElement('textarea');
        field.value = prompt;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        let copied = false;
        try {
          field.select();
          copied = document.execCommand('copy');
        } finally {
          field.remove();
        }
        if (!copied) throw new Error('Clipboard copy failed');
      }
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId(current => current === messageId ? '' : current), 1600);
    } catch {
      setSendError('Could not copy this question.');
    }
  };

  const canSend = !modelsLoading && !modelsError && models.length > 0 && Boolean(selectedModelId) && !sending;
  const selectedModel = models.find(model => model.id === selectedModelId);

  const handleModelKeyDown = event => {
    if (!models.length || modelsLoading || sending) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const selectedIndex = Math.max(0, models.findIndex(model => model.id === selectedModelId));
      if (!modelMenuOpen) {
        setActiveModelIndex(selectedIndex);
        setModelMenuOpen(true);
      } else {
        setActiveModelIndex(index => event.key === 'ArrowDown'
          ? Math.min(index + 1, models.length - 1)
          : Math.max(index - 1, 0));
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setModelMenuOpen(true);
      setActiveModelIndex(event.key === 'Home' ? 0 : models.length - 1);
    } else if ((event.key === 'Enter' || event.key === ' ') && modelMenuOpen) {
      event.preventDefault();
      const model = models[activeModelIndex];
      if (model) setSelectedModelId(model.id);
      setModelMenuOpen(false);
    } else if (event.key === 'Escape') {
      setModelMenuOpen(false);
    }
  };

  return (
    <div className="chat-page">
      <header className="chat-heading">
        <div>
          <span className="eyebrow">STORE ASSISTANT</span>
          <h1>Retailer chat</h1>
          <p>Ask questions about your store and its data.</p>
        </div>
        <div className="chat-header-actions">
          <div className="chat-model-field" ref={modelPickerRef}>
          <span id="chat-model-label">AI model</span>
          <button
            type="button"
            className="chat-model-trigger"
            aria-labelledby="chat-model-label chat-model-value"
            aria-haspopup="listbox"
            aria-expanded={modelMenuOpen}
            aria-controls="chat-model-options"
            aria-activedescendant={modelMenuOpen ? `chat-model-option-${activeModelIndex}` : undefined}
            disabled={modelsLoading || models.length === 0 || sending}
            onClick={() => {
              setActiveModelIndex(Math.max(0, models.findIndex(model => model.id === selectedModelId)));
              setModelMenuOpen(open => !open);
            }}
            onKeyDown={handleModelKeyDown}
          >
            <span id="chat-model-value">{modelsLoading ? 'Loading models…' : (selectedModel?.displayName || (models.length ? `${selectedModel?.provider} — ${selectedModel?.model}` : 'No models available'))}</span>
            <span className="chat-model-chevron" aria-hidden="true" />
          </button>
          {modelMenuOpen && models.length > 0 && (
            <div className="chat-model-menu" id="chat-model-options" role="listbox" aria-labelledby="chat-model-label">
              {models.map((model, index) => (
                <div
                  id={`chat-model-option-${index}`}
                  key={model.id}
                  role="option"
                  aria-selected={model.id === selectedModelId}
                  className={`chat-model-option${index === activeModelIndex ? ' active' : ''}`}
                  onMouseEnter={() => setActiveModelIndex(index)}
                  onClick={() => { setSelectedModelId(model.id); setModelMenuOpen(false); }}
                >
                  <span>{model.displayName || `${model.provider} — ${model.model}`}</span>
                  {model.id === selectedModelId && <span className="chat-model-check" aria-hidden="true">✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

          <div className="chat-history-toolbar">
        <div className="chat-history-picker" ref={historyPickerRef}>
          <button
            type="button"
            className="chat-history-trigger"
            aria-expanded={historyOpen}
            aria-controls="chat-history-panel"
            onClick={() => {
              const nextOpen = !historyOpen;
              setHistoryOpen(nextOpen);
              if (nextOpen && !historyLoaded) loadConversations(0);
            }}
            disabled={sending}
          >
            <span className="chat-history-trigger-label">Chat history</span>
            <span className="chat-history-trigger-value">{conversationId ? 'Saved conversation' : 'Current chat'}</span>
            <span className="chat-history-chevron" aria-hidden="true" />
          </button>
          {historyOpen && (
            <div className="chat-history-panel" id="chat-history-panel" role="region" aria-label="Saved conversations">
              <div className="chat-history-panel-heading">
                <strong>Saved conversations</strong>
                <span>Choose a chat to continue</span>
              </div>
              {historyLoading && <div className="chat-history-state" role="status">Loading conversations…</div>}
              {!historyLoading && historyError && (
                <div className="chat-history-state chat-history-state-error" role="alert">
                  <span>{historyError}</span>
                  <button type="button" onClick={() => loadConversations(historyPage)}>Retry</button>
                </div>
              )}
              {!historyLoading && !historyError && conversations.length === 0 && (
                <div className="chat-history-state">No saved conversations yet.</div>
              )}
              {!historyLoading && !historyError && conversations.length > 0 && (
                <div className="chat-history-list">
                  {conversations.map(item => (
                    <button
                      type="button"
                      className="chat-history-item"
                      key={item.conversationId}
                      aria-pressed={conversationId === item.conversationId}
                      disabled={sending}
                      onClick={() => openConversation(item.conversationId)}
                    >
                      <span className="chat-history-item-title">{item.title || 'Untitled conversation'}</span>
                      <span className="chat-history-item-date">{formatConversationDate(item.updatedAt)}</span>
                    </button>
                  ))}
                </div>
              )}
              {!historyLoading && !historyError && (
                <div className="chat-history-pagination">
                  <span>Page {historyPage + 1}</span>
                  <div>
                    <button type="button" onClick={() => loadConversations(historyPage - 1)} disabled={historyPage === 0}>Previous</button>
                    <button type="button" onClick={() => loadConversations(historyPage + 1)} disabled={!historyHasMore}>Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <button type="button" className="muted chat-new-button" onClick={startNewConversation} disabled={sending}>New chat</button>
          </div>
        </div>
      </header>

      <section className="chat-panel" aria-label="Retailer chat">
        <div className="chat-panel-note">
          <span className="chat-note-mark" aria-hidden="true">i</span>
          <p>Recent messages in this chat are used as context. Chats are saved to your account.</p>
        </div>

        {modelsLoading && <div className="chat-state" role="status">Loading available models…</div>}
        {!modelsLoading && modelsError && (
          <div className="chat-state chat-state-error" role="alert">
            <p>{modelsError}</p>
            <button type="button" className="muted" onClick={loadModels}>Retry loading models</button>
          </div>
        )}
        {!modelsLoading && !modelsError && models.length === 0 && (
          <div className="chat-state" role="status">
            <strong>No models are available</strong>
            <p>Ask your administrator to configure a chat model, then try again.</p>
            <button type="button" className="muted" onClick={loadModels}>Check again</button>
          </div>
        )}

        {!modelsLoading && !modelsError && models.length > 0 && (
          <>
            <div className="chat-messages" aria-live="polite" aria-relevant="additions text">
              {conversationRestoring ? (
                <div className="chat-empty" role="status"><strong>Restoring your conversation…</strong></div>
              ) : messages.length === 0 ? (
                <div className="chat-empty">
                  <span className="chat-empty-mark" aria-hidden="true">?</span>
                  <strong>What would you like to know?</strong>
                  <p>For example: “Which products are low on stock?”</p>
                </div>
              ) : messages.map((message, index) => {
                return <div className={`chat-message-row chat-message-row-${message.role}`} key={message.id} ref={index === messages.length - 1 ? latestMessageRef : null}>
                  <article className={`chat-message chat-message-${message.role}`}>
                    <span className="chat-message-label">{message.role === 'user' ? 'You' : 'Assistant'}</span>
                    {message.role === 'assistant'
                      ? <MarkdownAnswer content={message.content || 'No answer was returned.'} />
                      : <p>{message.content}</p>}
                    {message.dataSources?.length > 0 && (
                      <div className="chat-sources"><span>Sources</span>{message.dataSources.map((source, sourceIndex) => <span className="chat-source-tag" key={`${source}-${sourceIndex}`}>{source.replaceAll('_', ' ')}</span>)}</div>
                    )}
                  </article>
                  {message.role === 'user' && (
                    <div className="chat-message-actions">
                      <button type="button" className="chat-message-icon-button" onClick={() => copyQuestion(message.id, message.content)} aria-label={copiedMessageId === message.id ? 'Question copied' : 'Copy question'} title={copiedMessageId === message.id ? 'Copied' : 'Copy question'}>
                        <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6.5" y="6.5" width="10" height="11" rx="1.5" /><path d="M13.5 6.5V4.8A1.8 1.8 0 0 0 11.7 3H4.8A1.8 1.8 0 0 0 3 4.8v7A1.8 1.8 0 0 0 4.8 13.5h1.7" /></svg>
                      </button>
                      <button type="button" className="chat-message-icon-button" onClick={() => retryMessage(message.content)} disabled={sending || !selectedModelId} aria-label="Retry question" title="Retry question">
                        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.2 8A6.3 6.3 0 0 0 5.1 5.3L3.7 7" /><path d="M3.7 3.6V7h3.4M3.8 12a6.3 6.3 0 0 0 11.1 2.7l1.4-1.7" /><path d="M16.3 16.4V13h-3.4" /></svg>
                      </button>
                    </div>
                  )}
                </div>;
              })}
              {sending && <div className="chat-thinking" role="status"><span /> Thinking…</div>}
            </div>

            {sendError && <p className="error chat-error" role="alert">{sendError}</p>}

            <form className="chat-composer" onSubmit={sendMessage}>
              <label htmlFor="chat-question">Your question</label>
              <textarea
                id="chat-question"
                rows="2"
                maxLength="4000"
                placeholder="Ask about products, stock, or sales…"
                value={question}
                onChange={event => setQuestion(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form.requestSubmit();
                  }
                }}
                disabled={sending}
              />
              <div className="chat-composer-footer">
                <span>Enter to send · Shift+Enter for a new line</span>
                <button type="submit" className="chat-send-button" disabled={!canSend || !question.trim()}>
                  {sending ? 'Sending…' : 'Send question'}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
