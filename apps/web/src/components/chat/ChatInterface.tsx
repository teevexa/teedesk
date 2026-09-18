import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Mic, MicOff, Volume2, VolumeX, Bot, User,
  ThumbsUp, ThumbsDown, AlertCircle, WifiOff,
  Check, CheckCheck, Clock, Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChatStore, ChatMessage } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';
import { voiceService } from '@/lib/voice-service';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/shared/EmptyState';
import { MessageSkeleton } from '@/components/shared/SkeletonLoaders';
import { MessageAnalysisBadges } from '@/components/chat/MessageAnalysisBadges';
import apiClient from '@/services/api';

const SUPPORT_CATEGORIES = [
  { id: 'orders', label: 'Orders & Returns', prompt: 'I need help tracking my order' },
  { id: 'billing', label: 'Billing & Payments', prompt: 'I have a billing question' },
  { id: 'technical', label: 'Technical Support', prompt: 'I am experiencing a technical issue' },
  { id: 'account', label: 'Account Issues', prompt: 'I need help with my account' },
  { id: 'general', label: 'General Question', prompt: 'I have a general question' },
];

function MessageStatusIcon({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="h-3 w-3 text-primary" />;
  if (status === 'delivered') return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  if (status === 'sent') return <Check className="h-3 w-3 text-muted-foreground" />;
  return <Clock className="h-3 w-3 text-muted-foreground animate-pulse" />;
}

export const ChatInterface: React.FC = () => {
  const {
    messages,
    activeConversation,
    isSending,
    isLoadingMessages,
    error,
    inputValue,
    isVoiceListening,
    isSpeaking,
    wsStatus,
    typingUsers,
    sendMessage,
    setInputValue,
    sendTypingStart,
    sendTypingStop,
    setVoiceListening,
    setSpeaking,
    openConversation,
    markConversationRead,
  } = useChatStore();

  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const [isCreatingConv, setIsCreatingConv] = useState(false);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Mark as read when active conversation gains focus
  useEffect(() => {
    if (activeConversation) markConversationRead();
  }, [messages.length, activeConversation]);

  const conversationTyping = typingUsers.filter(
    (t) => t.conversation_id === activeConversation?.id
  );

  // Create + join a conversation if customer has none
  const ensureConversation = useCallback(async (): Promise<boolean> => {
    if (activeConversation) return true;
    if (!user) return false;

    setIsCreatingConv(true);
    try {
      const res = await apiClient.post('/conversations', {
        channel: 'web',
        title: 'Support Chat',
      });
      openConversation(res.data);
      return true;
    } catch (err: unknown) {
      toast({
        title: 'Could not start conversation',
        description: (err as { message?: string }).message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsCreatingConv(false);
    }
  }, [activeConversation, user, openConversation, toast]);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isSending) return;

    if (wsStatus !== 'connected') {
      toast({ title: 'Not connected', description: 'Reconnecting…', variant: 'destructive' });
      return;
    }

    const ok = await ensureConversation();
    if (!ok) return;

    sendTypingStop();
    sendMessage(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Typing indicator debounce
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const handleInput = (v: string) => {
    setInputValue(v);
    if (activeConversation && v.length > 0) {
      sendTypingStart();
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTypingStop(), 2_000);
    } else {
      sendTypingStop();
    }
  };

  const handleVoiceInput = async () => {
    if (!voiceService.isSpeechRecognitionSupported()) {
      toast({ title: 'Voice not supported', variant: 'destructive' });
      return;
    }
    try {
      setVoiceListening(true);
      const transcript = await voiceService.startListening();
      setInputValue(transcript);
    } catch {
      toast({ title: 'Voice error', description: 'Could not capture voice input.', variant: 'destructive' });
    } finally {
      setVoiceListening(false);
    }
  };

  const handleSpeak = async (content: string) => {
    if (!voiceService.isSpeechSynthesisSupported()) return;
    try {
      setSpeaking(true);
      await voiceService.speak(content);
    } finally {
      setSpeaking(false);
    }
  };

  const handleFeedback = async (messageId: string, rating: 'positive' | 'negative') => {
    if (!activeConversation) return;
    try {
      await apiClient.post('/feedback', {
        conversation_id: activeConversation.id,
        message_id: messageId,
        rating,
      });
      toast({ title: 'Feedback received', description: 'Thank you!' });
    } catch {
      toast({ title: 'Error', description: 'Could not submit feedback.', variant: 'destructive' });
    }
  };

  const showCategories = !activeConversation && messages.length === 0;
  const isConnected = wsStatus === 'connected';

  return (
    <div className="flex flex-col h-full max-h-full">
      {showCategories && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border-b"
        >
          <p className="text-sm font-medium mb-3 text-muted-foreground">
            What can I help you with?
          </p>
          <div className="flex flex-wrap gap-2">
            {SUPPORT_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setInputValue(cat.prompt)}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 min-h-0">
        {isLoadingMessages && (
          <div className="space-y-4">
            <MessageSkeleton />
            <MessageSkeleton />
          </div>
        )}

        {!isLoadingMessages && messages.length === 0 && !showCategories && (
          <div className="h-full flex items-center justify-center">
            <EmptyState icon={Bot} title="Conversation started" description="Send a message to begin." />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              currentUserId={user?.id ?? ''}
              onSpeak={handleSpeak}
              onFeedback={handleFeedback}
              isSpeaking={isSpeaking}
            />
          ))}
        </AnimatePresence>

        {/* Typing indicators */}
        <AnimatePresence>
          {conversationTyping.map((t) => (
            <motion.div
              key={t.user_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex gap-3 justify-start"
            >
              <div className="flex-shrink-0 p-2 rounded-full bg-muted self-end">
                <User className="h-4 w-4" />
              </div>
              <div className="glass-card rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 0.2, 0.4].map((delay, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{t.name} is typing…</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass-card border-0 border-t rounded-none p-4 flex-shrink-0">
        {!isConnected && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <WifiOff className="h-3 w-3" />
            {wsStatus === 'connecting' ? 'Connecting…' : 'Offline — reconnecting…'}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            aria-label="Message"
            value={inputValue}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message… (Enter to send, Shift+Enter for newline)"
            disabled={isSending || isCreatingConv}
            rows={1}
            className="flex-1 glass bg-input-glass border-border/30 focus:border-primary resize-none min-h-[40px] max-h-[120px]"
            style={{ height: 'auto' }}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={isVoiceListening ? 'Stop voice input' : 'Start voice input'}
            onClick={handleVoiceInput}
            disabled={isVoiceListening || isSending}
            className={`glass-card flex-shrink-0 ${isVoiceListening ? 'glow-primary' : ''}`}
          >
            {isVoiceListening ? <MicOff className="h-4 w-4 text-destructive" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button
            aria-label="Send message"
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending || isCreatingConv}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---- Extracted MessageBubble for clarity ----

interface BubbleProps {
  message: ChatMessage;
  currentUserId: string;
  onSpeak: (c: string) => void;
  onFeedback: (id: string, r: 'positive' | 'negative') => void;
  isSpeaking: boolean;
}

const MessageBubble: React.FC<BubbleProps> = ({
  message,
  currentUserId,
  onSpeak,
  onFeedback,
  isSpeaking,
}) => {
  const isOwn = message.sender_id === currentUserId && !message.is_bot;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex gap-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {!isOwn && (
        <div className="flex-shrink-0 p-2 rounded-full bg-gradient-primary shadow-glow self-end">
          {message.is_bot ? (
            <Bot className="h-4 w-4 text-primary-foreground" />
          ) : (
            <User className="h-4 w-4 text-primary-foreground" />
          )}
        </div>
      )}

      <div className="max-w-[80%]">
        <div
          className={`rounded-2xl p-4 shadow-chat ${
            isOwn
              ? 'bg-gradient-chat-user text-primary-foreground'
              : 'glass-card'
          } ${message.isOptimistic ? 'opacity-60' : ''}`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>

          {!message.is_bot && (
            <MessageAnalysisBadges
              analysis={message.analysis}
              sentiment={message.sentiment}
              sentimentScore={message.sentiment_score}
              intent={message.intent}
              intentConfidence={message.intent_confidence}
              entities={message.entities}
            />
          )}

          {message.is_bot && (
            <div className="flex items-center gap-1 mt-2">
              <Button
                variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => onSpeak(message.content)} disabled={isSpeaking}
              >
                {isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => onFeedback(message.id, 'positive')}>
                <ThumbsUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                onClick={() => onFeedback(message.id, 'negative')}>
                <ThumbsDown className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 mt-1 px-2">
          <p className="text-xs text-muted-foreground">
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          {isOwn && <MessageStatusIcon status={message.isOptimistic ? 'pending' : message.status} />}
        </div>
      </div>

      {isOwn && (
        <div className="flex-shrink-0 p-2 rounded-full bg-gradient-chat-user self-end">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </motion.div>
  );
};
