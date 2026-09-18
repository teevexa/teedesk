/**
 * Agent dashboard — live conversation queue with filters.
 * Visible to agents, support_agents, admins, and super_admins.
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Clock, AlertTriangle, CheckCircle2,
  User, RefreshCw, Filter, Inbox, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useChatStore } from '@/store/chat.store';
import { useAuthStore } from '@/store/auth.store';
import { Conversation } from '@/types';
import { ChatInterface } from '@/components/chat/ChatInterface';
import apiClient from '@/services/api';
import { useToast } from '@/hooks/use-toast';

type Filter = 'all' | 'open' | 'escalated' | 'resolved' | 'assigned';

const FILTER_TABS: { value: Filter; label: string; icon: React.ElementType }[] = [
  { value: 'open', label: 'Open', icon: Inbox },
  { value: 'escalated', label: 'Escalated', icon: AlertTriangle },
  { value: 'assigned', label: 'Assigned to me', icon: User },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2 },
  { value: 'all', label: 'All', icon: MessageCircle },
];

function statusBadgeVariant(status: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'escalated') return 'destructive';
  if (status === 'open') return 'default';
  if (status === 'resolved') return 'secondary';
  return 'outline';
}

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ConversationItem: React.FC<{
  conv: Conversation;
  isActive: boolean;
  unreadCount: number;
  onClick: () => void;
}> = ({ conv, isActive, unreadCount, onClick }) => (
  <motion.button
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    onClick={onClick}
    className={`w-full text-left p-4 rounded-xl border transition-all duration-150 ${
      isActive
        ? 'border-primary bg-primary/10'
        : 'border-border/30 hover:border-primary/40 hover:bg-muted/30'
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">
            {conv.title || `Conversation #${conv.id.slice(0, 8)}`}
          </span>
          {unreadCount > 0 && (
            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusBadgeVariant(conv.status)} className="text-xs h-5">
            {conv.status}
          </Badge>
          <span className="text-xs text-muted-foreground">{conv.channel}</span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <span className="text-xs text-muted-foreground">{relativeTime(conv.updated_at)}</span>
        {conv.message_count !== undefined && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  </motion.button>
);

export const AgentDashboard: React.FC = () => {
  const {
    conversations,
    isLoadingConversations,
    conversationFilter,
    activeConversation,
    unreadCounts,
    wsStatus,
    openConversation,
    closeConversation,
    setConversationFilter,
    loadConversations,
  } = useChatStore();

  const { user } = useAuthStore();
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, []);

  const filteredConversations = React.useMemo(() => {
    if (conversationFilter === 'assigned') {
      return conversations.filter((c) => c.assigned_agent_id === user?.id);
    }
    if (conversationFilter === 'all') return conversations;
    return conversations.filter((c) => c.status === conversationFilter);
  }, [conversations, conversationFilter, user?.id]);

  const handleAssign = async (convId: string) => {
    try {
      await apiClient.patch(`/conversations/${convId}`, {
        assigned_agent_id: user?.id,
      });
      loadConversations();
      toast({ title: 'Conversation assigned to you' });
    } catch {
      toast({ title: 'Could not assign conversation', variant: 'destructive' });
    }
  };

  const handleResolve = async (convId: string) => {
    try {
      await apiClient.post(`/conversations/${convId}/resolve`);
      closeConversation();
      loadConversations();
      toast({ title: 'Conversation resolved' });
    } catch {
      toast({ title: 'Could not resolve conversation', variant: 'destructive' });
    }
  };

  const handleEscalate = async (convId: string) => {
    try {
      await apiClient.post(`/conversations/${convId}/escalate`, {
        reason: 'Agent escalation',
        priority: 'high',
      });
      loadConversations();
      toast({ title: 'Conversation escalated' });
    } catch {
      toast({ title: 'Could not escalate', variant: 'destructive' });
    }
  };

  return (
    <div className="flex h-full gap-0 min-h-0">
      {/* ---- Left panel: conversation queue ----
          On mobile, only one panel is visible at a time (queue or the open
          conversation) — a fixed 320px queue alongside a chat panel left no
          usable width for the conversation on a phone-sized viewport. */}
      <div
        className={`w-full md:w-80 flex-shrink-0 flex-col border-r border-border/30 min-h-0 ${
          activeConversation ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border/30 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-sm">Live Queue</h2>
              <div className={`h-2 w-2 rounded-full ${
                wsStatus === 'connected' ? 'bg-green-500' : 'bg-muted-foreground animate-pulse'
              }`} />
            </div>
            <Button
              variant="ghost" size="sm"
              onClick={loadConversations}
              disabled={isLoadingConversations}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingConversations ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Summary pills */}
          <div className="flex gap-2 flex-wrap">
            {['open', 'escalated'].map((s) => {
              const count = conversations.filter((c) => c.status === s).length;
              if (!count) return null;
              return (
                <Badge
                  key={s}
                  variant={s === 'escalated' ? 'destructive' : 'default'}
                  className="text-xs"
                >
                  {count} {s}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-3 pt-3 flex-shrink-0">
          <Tabs
            value={conversationFilter}
            onValueChange={(v) => setConversationFilter(v as Filter)}
          >
            <TabsList className="w-full grid grid-cols-3 h-8 text-xs">
              <TabsTrigger value="open" className="text-xs">Open</TabsTrigger>
              <TabsTrigger value="escalated" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Urgent
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1 min-h-0 px-3 py-2">
          {isLoadingConversations ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No conversations</p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {filteredConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isActive={activeConversation?.id === conv.id}
                    unreadCount={unreadCounts[conv.id] ?? 0}
                    onClick={() => openConversation(conv)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ---- Right panel: active conversation ---- */}
      <div
        className={`flex-1 flex-col min-h-0 min-w-0 ${
          activeConversation ? 'flex' : 'hidden md:flex'
        }`}
      >
        {activeConversation ? (
          <>
            {/* Conversation toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 flex-shrink-0 md:hidden"
                  onClick={closeConversation}
                  aria-label="Back to queue"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {activeConversation.title || `Conversation #${activeConversation.id.slice(0, 8)}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusBadgeVariant(activeConversation.status)} className="text-xs h-4">
                      {activeConversation.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {activeConversation.channel}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {!activeConversation.assigned_agent_id && (
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => handleAssign(activeConversation.id)}
                  >
                    <User className="h-3 w-3 mr-1" />
                    Assign to me
                  </Button>
                )}
                {activeConversation.status === 'open' && (
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs text-destructive"
                    onClick={() => handleEscalate(activeConversation.id)}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Escalate
                  </Button>
                )}
                {activeConversation.status !== 'resolved' && activeConversation.status !== 'closed' && (
                  <Button
                    size="sm" className="h-7 text-xs"
                    onClick={() => handleResolve(activeConversation.id)}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Resolve
                  </Button>
                )}
              </div>
            </div>

            {/* Chat messages */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatInterface />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Select a conversation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Choose from the queue on the left to start responding
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
