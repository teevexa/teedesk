/**
 * WebSocket service — singleton that manages one connection to /api/v1/ws.
 *
 * Features:
 *   • JWT authentication via first frame
 *   • Typed event emitter (on/off/once)
 *   • Outbound queue: messages sent while disconnected are replayed on reconnect
 *   • Exponential-backoff reconnect (max 30 s)
 *   • 30-second heartbeat ping
 */

export type WSStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface WSFrame {
  type: string;
  [key: string]: unknown;
}

type Listener = (frame: WSFrame) => void;

const WS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws') + '/api/v1/ws';

const MAX_RECONNECT_ATTEMPTS = 8;
const PING_INTERVAL_MS = 30_000;
const AUTH_TIMEOUT_MS = 12_000;

class WebSocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private _status: WSStatus = 'idle';

  private listeners = new Map<string, Set<Listener>>();
  private sendQueue: WSFrame[] = [];

  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private authTimer: ReturnType<typeof setTimeout> | null = null;

  // ---- Connection lifecycle ----------------------------------------

  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.token = token;
    this._doConnect();
  }

  private _doConnect(): void {
    this._clearTimers();
    this._setStatus('connecting');

    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      // Send auth frame immediately
      this._rawSend({ type: 'authenticate', token: this.token! });

      // Guard against server not responding to auth
      this.authTimer = setTimeout(() => {
        if (this._status !== 'connected') {
          this.ws?.close();
        }
      }, AUTH_TIMEOUT_MS);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      let frame: WSFrame;
      try {
        frame = JSON.parse(event.data as string) as WSFrame;
      } catch {
        return;
      }

      if (frame.type === 'authenticated') {
        clearTimeout(this.authTimer!);
        this.reconnectAttempts = 0;
        this._setStatus('connected');
        this._flushQueue();
        this._startHeartbeat();
      }

      this._emit(frame.type, frame);
    };

    this.ws.onerror = () => {
      this._setStatus('error');
    };

    this.ws.onclose = () => {
      this._stopHeartbeat();
      this._setStatus('disconnected');
      this._scheduleReconnect();
    };
  }

  disconnect(): void {
    this.token = null;
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // prevent auto-reconnect
    this._clearTimers();
    this.ws?.close(1000, 'user logout');
    this.ws = null;
    this._setStatus('idle');
  }

  // ---- Sending --------------------------------------------------------

  send(frame: WSFrame): void {
    if (this._status === 'connected') {
      this._rawSend(frame);
    } else {
      this.sendQueue.push(frame);
    }
  }

  private _rawSend(frame: WSFrame): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  private _flushQueue(): void {
    const q = this.sendQueue.splice(0);
    q.forEach((f) => this._rawSend(f));
  }

  // ---- High-level actions (called by chat store) ----------------------

  joinConversation(conversationId: string): void {
    this.send({ type: 'join', conversation_id: conversationId });
  }

  leaveConversation(conversationId: string): void {
    this.send({ type: 'leave', conversation_id: conversationId });
  }

  sendMessage(conversationId: string, content: string, tempId: string): void {
    this.send({ type: 'message', conversation_id: conversationId, content, temp_id: tempId });
  }

  sendTypingStart(conversationId: string): void {
    this.send({ type: 'typing_start', conversation_id: conversationId });
  }

  sendTypingStop(conversationId: string): void {
    this.send({ type: 'typing_stop', conversation_id: conversationId });
  }

  markRead(messageId: string): void {
    this.send({ type: 'read', message_id: messageId });
  }

  // ---- Events ---------------------------------------------------------

  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  once(event: string, listener: Listener): void {
    const off = this.on(event, (frame) => {
      off();
      listener(frame);
    });
  }

  private _emit(event: string, frame: WSFrame): void {
    this.listeners.get(event)?.forEach((l) => l(frame));
    // Wildcard listeners registered as "*"
    if (event !== '*') this.listeners.get('*')?.forEach((l) => l(frame));
  }

  // ---- Status ---------------------------------------------------------

  get status(): WSStatus {
    return this._status;
  }

  private _setStatus(s: WSStatus): void {
    this._status = s;
    this._emit('status_change', { type: 'status_change', status: s });
  }

  // ---- Heartbeat ------------------------------------------------------

  private _startHeartbeat(): void {
    this.pingTimer = setInterval(() => {
      this.send({ type: 'ping' });
    }, PING_INTERVAL_MS);
  }

  private _stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  // ---- Reconnect ------------------------------------------------------

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS || !this.token) return;
    const delay = Math.min(500 * 2 ** this.reconnectAttempts, 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this._doConnect(), delay);
  }

  private _clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.authTimer) clearTimeout(this.authTimer);
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.authTimer = null;
  }
}

export const wsService = new WebSocketService();
