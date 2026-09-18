/**
 * Chat store — owns all real-time state.
 *
 * Responsibilities:
 *   • Boot / tear-down the WebSocket connection
 *   • Maintain the active conversation + its messages
 *   • Maintain the agent conversation list (queue)
 *   • Track typing indicators, presence, unread counts
 *   • Expose optimistic send + confirmed reconciliation
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { wsService, WSFrame } from '@/services/websocket.service';
import {
  AnalysisResult,
  Message,
  Conversation,
  TypingUser,
  PresenceUser,
  WSStatus,
} from '@/types';

export interface ChatMessage extends Message {
  isOptimistic?: boolean;
  isTypingPlaceholder?: boolean;
}

interface ChatState {
  // ---- WebSocket ----
  wsStatus: WSStatus;

  // ---- Active conversation (customer view) ----
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  isLoadingMessages: boolean;
  isSending: boolean;
  error: string | null;

  // ---- Agent queue ----
  conversations: Conversation[];
  isLoadingConversations: boolean;
  conversationFilter: 'all' | 'open' | 'escalated' | 'resolved' | 'assigned';

  // ---- Real-time state ----
  typingUsers: TypingUser[];           // who is currently typing, per conversation
  presence: Record<string, PresenceUser>; // user_id → PresenceUser
  unreadCounts: Record<string, number>;   // conversation_id → count

  // ---- UI ----
  inputValue: string;
  isVoiceListening: boolean;
  isSpeaking: boolean;

  // ---- Actions: WS lifecycle ----
  initWS: (token: string) => void;
  teardownWS: () => void;

  // ---- Actions: conversations ----
  loadConversations: () => Promise<void>;
  setConversationFilter: (f: ChatState['conversationFilter']) => void;
  openConversation: (conv: Conversation) => void;
  closeConversation: () => void;

  // ---- Actions: messaging ----
  sendMessage: (content: string) => void;
  setInputValue: (v: string) => void;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  markConversationRead: () => void;

  // ---- Actions: voice ----
  setVoiceListening: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;

  // ---- Internal WS handlers (called from _setupListeners) ----
  _onMessage: (frame: WSFrame) => void;
  _onBotMessage: (frame: WSFrame) => void;
  _onTyping: (frame: WSFrame) => void;
  _onPresence: (frame: WSFrame) => void;
  _onJoined: (frame: WSFrame) => void;
  _onMessageStatus: (frame: WSFrame) => void;
  _onConversationActivity: (frame: WSFrame) => void;
  _onStatusChange: (frame: WSFrame) => void;
  _onMessageAnalysis: (frame: WSFrame) => void;

  reset: () => void;
}

// ---- Listener cleanup registry ----
let _off: Array<() => void> = [];

function _setupListeners(get: () => ChatState): void {
  _off.forEach((f) => f());
  _off = [];

  const s = get();
  _off.push(wsService.on('message', s._onMessage));
  _off.push(wsService.on('bot_message', s._onBotMessage));
  _off.push(wsService.on('typing', s._onTyping));
  _off.push(wsService.on('presence', s._onPresence));
  _off.push(wsService.on('joined', s._onJoined));
  _off.push(wsService.on('message_status', s._onMessageStatus));
  _off.push(wsService.on('conversation_activity', s._onConversationActivity));
  _off.push(wsService.on('status_change', s._onStatusChange));
  _off.push(wsService.on('message_analysis', s._onMessageAnalysis));
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // ---- initial state ----
      wsStatus: 'idle',
      activeConversation: null,
      messages: [],
      isLoadingMessages: false,
      isSending: false,
      error: null,
      conversations: [],
      isLoadingConversations: false,
      conversationFilter: 'open',
      typingUsers: [],
      presence: {},
      unreadCounts: {},
      inputValue: '',
      isVoiceListening: false,
      isSpeaking: false,

      // ---- WS lifecycle ----
      initWS: (token) => {
        _setupListeners(get);
        wsService.connect(token);
      },

      teardownWS: () => {
        _off.forEach((f) => f());
        _off = [];
        wsService.disconnect();
      },

      // ---- Conversation list (agent queue) ----
      loadConversations: async () => {
        set({ isLoadingConversations: true });
        try {
          const { apiClient } = await import('@/services/api');
          const filter = get().conversationFilter;
          const params: Record<string, string> = {};
          if (filter !== 'all') params.status = filter;
          const res = await apiClient.get('/conversations', { params });
          set({ conversations: res.data.items ?? [], isLoadingConversations: false });
        } catch {
          set({ isLoadingConversations: false });
        }
      },

      setConversationFilter: (conversationFilter) => {
        set({ conversationFilter });
        get().loadConversations();
      },

      openConversation: (conv) => {
        const prev = get().activeConversation;
        if (prev && prev.id !== conv.id) {
          wsService.leaveConversation(prev.id);
        }
        set({ activeConversation: conv, messages: [], error: null });
        wsService.joinConversation(conv.id);
      },

      closeConversation: () => {
        const conv = get().activeConversation;
        if (conv) wsService.leaveConversation(conv.id);
        set({ activeConversation: null, messages: [] });
      },

      // ---- Messaging ----
      sendMessage: (content) => {
        const conv = get().activeConversation;
        if (!conv || !content.trim() || get().isSending) return;

        const tempId = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const optimistic: ChatMessage = {
          id: tempId,
          conversation_id: conv.id,
          content,
          is_bot: false,
          status: 'sent',
          isOptimistic: true,
          created_at: new Date().toISOString(),
        };

        set((state) => ({
          messages: [...state.messages, optimistic],
          inputValue: '',
          isSending: true,
        }));

        wsService.sendMessage(conv.id, content, tempId);

        // Safety timeout: if no echo in 8 s, mark as failed
        setTimeout(() => {
          const still = get().messages.find((m) => m.id === tempId);
          if (still?.isOptimistic) {
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === tempId ? { ...m, isOptimistic: false, status: 'sent' } : m
              ),
              isSending: false,
            }));
          }
        }, 8_000);
      },

      setInputValue: (inputValue) => set({ inputValue }),

      sendTypingStart: () => {
        const conv = get().activeConversation;
        if (conv) wsService.sendTypingStart(conv.id);
      },

      sendTypingStop: () => {
        const conv = get().activeConversation;
        if (conv) wsService.sendTypingStop(conv.id);
      },

      markConversationRead: () => {
        const conv = get().activeConversation;
        if (!conv) return;
        const msgs = get().messages;
        const last = [...msgs].reverse().find((m) => !m.isOptimistic && m.status !== 'read');
        if (last) wsService.markRead(last.id);
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [conv.id]: 0 },
        }));
      },

      // ---- Voice ----
      setVoiceListening: (isVoiceListening) => set({ isVoiceListening }),
      setSpeaking: (isSpeaking) => set({ isSpeaking }),

      // ---- Internal WS event handlers ----
      _onJoined: (frame) => {
        const serverMsgs = (frame.messages as ChatMessage[] | undefined) ?? [];
        const conv = frame.conversation as Conversation | undefined;
        set((state) => {
          // Keep any optimistic messages that were sent between openConversation()
          // and the server's joined confirmation (e.g. the very first message typed).
          // Without this, the server's empty message list overwrites the optimistic one.
          const pendingOptimistic = state.messages.filter((m) => m.isOptimistic);
          const merged = [
            ...serverMsgs,
            ...pendingOptimistic.filter((opt) => !serverMsgs.some((s) => s.id === opt.id)),
          ];
          return {
            messages: merged,
            isLoadingMessages: false,
            activeConversation: conv ?? state.activeConversation,
          };
        });
      },

      _onMessage: (frame) => {
        const incoming = frame.data as ChatMessage;
        const tempId = frame.temp_id as string | undefined;
        const activeConvId = get().activeConversation?.id;

        set((state) => {
          let msgs = state.messages;

          // Replace optimistic placeholder if temp_id matches
          if (tempId) {
            msgs = msgs.map((m) => (m.id === tempId ? { ...incoming, isOptimistic: false } : m));
          } else if (incoming.conversation_id === activeConvId) {
            // Message from another participant — only add if not already present
            const exists = msgs.some((m) => m.id === incoming.id);
            if (!exists) msgs = [...msgs, incoming];
          }

          // Unread: bump counter if this conv isn't the active one
          const unread = { ...state.unreadCounts };
          if (incoming.conversation_id !== activeConvId) {
            unread[incoming.conversation_id] = (unread[incoming.conversation_id] ?? 0) + 1;
          }

          return { messages: msgs, isSending: false, unreadCounts: unread };
        });

        // Update conversation list order
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === incoming.conversation_id
              ? { ...c, message_count: (c.message_count ?? 0) + 1, updated_at: incoming.created_at }
              : c
          ),
        }));
      },

      _onBotMessage: (frame) => {
        const incoming = frame.data as ChatMessage;
        const activeConvId = get().activeConversation?.id;
        if (incoming.conversation_id !== activeConvId) return;

        set((state) => {
          const exists = state.messages.some((m) => m.id === incoming.id);
          if (exists) return state;
          return { messages: [...state.messages, { ...incoming, is_bot: true }] };
        });
      },

      _onTyping: (frame) => {
        const { user_id, name, conversation_id, is_typing } = frame as {
          user_id: string;
          name: string;
          conversation_id: string;
          is_typing: boolean;
        };

        set((state) => {
          const filtered = state.typingUsers.filter(
            (t) => !(t.user_id === user_id && t.conversation_id === conversation_id)
          );
          if (is_typing) {
            return { typingUsers: [...filtered, { user_id, name, conversation_id }] };
          }
          return { typingUsers: filtered };
        });
      },

      _onPresence: (frame) => {
        const { user_id, name, status } = frame as {
          user_id: string;
          name: string;
          status: 'online' | 'offline';
        };
        set((state) => ({
          presence: { ...state.presence, [user_id]: { user_id, name, status } },
        }));
      },

      _onMessageStatus: (frame) => {
        const { message_id, status } = frame as { message_id: string; status: string };
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === message_id ? { ...m, status: status as Message['status'] } : m
          ),
        }));
      },

      _onConversationActivity: (frame) => {
        // Reload conversations when there's activity in the tenant
        const { conversation_id } = frame as { conversation_id: string };
        const alreadyHave = get().conversations.some((c) => c.id === conversation_id);
        if (!alreadyHave) {
          get().loadConversations();
        }
      },

      _onStatusChange: (frame) => {
        set({ wsStatus: frame.status as WSStatus });
      },

      _onMessageAnalysis: (frame) => {
        const { message_id, data } = frame as { message_id: string; data: AnalysisResult };
        if (!message_id || !data) return;
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === message_id
              ? {
                  ...m,
                  analysis: data,
                  sentiment: data.sentiment ?? m.sentiment,
                  sentiment_score: data.sentiment_score ?? m.sentiment_score,
                  intent: data.intent ?? m.intent,
                  intent_confidence: data.intent_confidence ?? m.intent_confidence,
                  entities: data.entities.length > 0 ? data.entities : m.entities,
                }
              : m
          ),
        }));
      },

      reset: () =>
        set({
          activeConversation: null,
          messages: [],
          isLoadingMessages: false,
          isSending: false,
          error: null,
          inputValue: '',
          typingUsers: [],
        }),
    }),
    { name: 'chat-store' }
  )
);
