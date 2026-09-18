import React, { useCallback, useEffect, useRef, useState } from 'react';
import { styles } from './styles';

interface Message {
  id: string;
  content: string;
  isBot: boolean;
  status: 'sending' | 'sent' | 'error';
  createdAt: string;
}

interface Props {
  tenantId: string;
  apiUrl: string;
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
}

type WSStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

const PING_MS = 30_000;
const MAX_RECONNECT = 6;

export const Widget: React.FC<Props> = ({ tenantId, apiUrl, primaryColor, position }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [wsStatus, setWsStatus] = useState<WSStatus>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const wsUrl = apiUrl.replace(/^http/, 'ws') + '/api/v1/ws';

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Acquire a guest session token from the API
  const getGuestSession = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/v1/widget/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (!res.ok) throw new Error('Session request failed');
      const data = await res.json() as { access_token: string; conversation_id: string };
      setSessionToken(data.access_token);
      setConversationId(data.conversation_id);
      return data;
    } catch {
      return null;
    }
  }, [apiUrl, tenantId]);

  const disconnect = useCallback(() => {
    if (pingRef.current) clearInterval(pingRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    wsRef.current?.close(1000, 'widget closed');
    wsRef.current = null;
    setWsStatus('idle');
  }, []);

  const connect = useCallback(
    (token: string, convId: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      setWsStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'authenticate', token }));
      };

      ws.onmessage = (ev) => {
        let frame: Record<string, unknown>;
        try { frame = JSON.parse(ev.data as string) as Record<string, unknown>; }
        catch { return; }

        switch (frame.type) {
          case 'authenticated':
            reconnectRef.current = 0;
            setWsStatus('connected');
            ws.send(JSON.stringify({ type: 'join', conversation_id: convId }));
            pingRef.current = setInterval(() => ws.send(JSON.stringify({ type: 'ping' })), PING_MS);
            break;

          case 'bot_message': {
            const msg = frame.data as { id: string; content: string; created_at: string };
            setIsTyping(false);
            setMessages((prev) => [
              ...prev,
              { id: msg.id, content: msg.content, isBot: true, status: 'sent', createdAt: msg.created_at },
            ]);
            break;
          }

          case 'message': {
            const msg = frame.data as { id: string; content: string; is_bot: boolean; created_at: string };
            const tempId = frame.temp_id as string | undefined;
            setMessages((prev) => {
              if (tempId) {
                // Echo of our own optimistically-sent message — reconcile it.
                return prev.map((m) =>
                  m.id === tempId ? { ...m, id: msg.id, status: 'sent' } : m
                );
              }
              // A message from someone else in the conversation (e.g. a human
              // agent replying from the dashboard) — append it if not already present.
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [
                ...prev,
                { id: msg.id, content: msg.content, isBot: msg.is_bot, status: 'sent', createdAt: msg.created_at },
              ];
            });
            break;
          }

          case 'typing':
            if ((frame as { is_typing?: boolean }).is_typing) setIsTyping(true);
            else setIsTyping(false);
            break;

          case 'error':
            console.warn('[TeeDesk widget]', frame.message);
            break;
        }
      };

      ws.onerror = () => setWsStatus('error');

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        setWsStatus('disconnected');
        if (reconnectRef.current < MAX_RECONNECT) {
          const delay = Math.min(500 * 2 ** reconnectRef.current, 20_000);
          reconnectRef.current++;
          reconnectTimerRef.current = setTimeout(() => connect(token, convId), delay);
        }
      };
    },
    [wsUrl]
  );

  // Boot WebSocket when widget opens for the first time
  useEffect(() => {
    if (!open) return;
    if (wsStatus !== 'idle') return;

    getGuestSession().then((session) => {
      if (session) connect(session.access_token, session.conversation_id);
    });
  }, [open, wsStatus, getGuestSession, connect]);

  // Disconnect when widget is unmounted
  useEffect(() => () => disconnect(), [disconnect]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content || wsStatus !== 'connected' || !conversationId) return;

    const tempId = `opt_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, content, isBot: false, status: 'sending', createdAt: new Date().toISOString() },
    ]);
    setInput('');
    setIsTyping(true);

    wsRef.current?.send(
      JSON.stringify({ type: 'message', conversation_id: conversationId, content, temp_id: tempId })
    );
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const positionStyle: React.CSSProperties =
    position === 'bottom-left' ? { bottom: 24, left: 24 } : { bottom: 24, right: 24 };

  return (
    <>
      <style>{styles(primaryColor)}</style>

      {/* Launcher button */}
      <button
        className="td-launcher"
        style={positionStyle}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="td-panel" style={positionStyle}>
          {/* Header */}
          <div className="td-header">
            <div className="td-header-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="td-header-title">Support</p>
              <p className="td-header-sub">
                {wsStatus === 'connected' ? 'Online' : wsStatus === 'connecting' ? 'Connecting…' : 'Offline'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="td-messages">
            {messages.length === 0 && (
              <div className="td-welcome">
                <p>👋 Hi! How can we help you today?</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`td-msg ${msg.isBot ? 'td-msg--bot' : 'td-msg--user'}`}>
                <p className="td-msg-content">{msg.content}</p>
                {!msg.isBot && msg.status === 'sending' && (
                  <span className="td-msg-status">Sending…</span>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="td-msg td-msg--bot">
                <span className="td-typing">
                  <span /><span /><span />
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="td-input-row">
            <textarea
              className="td-input"
              aria-label="Message"
              placeholder="Type a message…"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={wsStatus !== 'connected'}
            />
            <button
              className="td-send"
              onClick={sendMessage}
              disabled={!input.trim() || wsStatus !== 'connected'}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
              </svg>
            </button>
          </div>

          <p className="td-branding">Powered by TeeDesk</p>
        </div>
      )}
    </>
  );
};
