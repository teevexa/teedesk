import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, Clock, MessageSquare, Filter, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { conversationService } from '@/services/conversation.service';
import { chatService } from '@/services/chat.service';
import { ConversationCardSkeleton } from '@/components/shared/SkeletonLoaders';
import { EmptyState } from '@/components/shared/EmptyState';
import { useUIStore } from '@/store';
import { Conversation, ConversationStatus } from '@/types';

type FilterValue = 'all' | ConversationStatus;

export const ConversationHistory: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<FilterValue>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { isBackendConnected } = useUIStore();

  const { data: listData, isLoading } = useQuery({
    queryKey: ['conversations', 'list'],
    queryFn: () => conversationService.list(1, 50),
    enabled: isBackendConnected,
    staleTime: 30_000,
  });

  const { data: messagesData } = useQuery({
    queryKey: ['conversations', 'messages', selectedId],
    queryFn: () => chatService.getMessages(selectedId!),
    enabled: !!selectedId && isBackendConnected,
  });

  const conversations = listData?.data ?? [];

  const filtered = conversations.filter((conv) => {
    const matchesSearch =
      !searchQuery ||
      conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterBy === 'all' || conv.status === filterBy;
    return matchesSearch && matchesFilter;
  });

  const selectedConversation = conversations.find((c) => c.id === selectedId) ?? null;

  const getStatusBadge = (status: ConversationStatus) => {
    const map: Record<ConversationStatus, { label: string; className: string }> = {
      open: { label: 'Open', className: 'bg-primary/20 text-primary' },
      escalated: { label: 'Escalated', className: 'bg-warning/20 text-warning' },
      resolved: { label: 'Resolved', className: 'bg-success/20 text-success' },
      closed: { label: 'Closed', className: 'bg-muted text-muted-foreground' },
    };
    const { label, className } = map[status] || map.open;
    return <Badge className={`text-xs ${className}`}>{label}</Badge>;
  };

  if (!isBackendConnected) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Conversation History Unavailable"
        description="Connect the SupportIQ backend to view and manage conversation history."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* List */}
      <div className="space-y-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5" />
              Conversation History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterValue)}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => <ConversationCardSkeleton key={i} />)}

              {!isLoading && filtered.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No conversations found.
                </div>
              )}

              {filtered.map((conv) => (
                <motion.div key={conv.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Card
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedId === conv.id
                        ? 'bg-gradient-primary text-primary-foreground'
                        : 'glass hover:shadow-glow'
                    }`}
                    onClick={() => setSelectedId(conv.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-sm truncate">
                          {conv.title || `Conversation ${conv.id.slice(0, 8)}`}
                        </h3>
                        <div className="flex items-center gap-1 text-xs opacity-70 ml-2 flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {new Date(conv.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        {getStatusBadge(conv.status)}
                        {conv.message_count !== undefined && (
                          <span className="text-xs opacity-60">{conv.message_count} msgs</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail */}
      <div>
        {selectedConversation ? (
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle className="text-base">
                {selectedConversation.title || `Conversation ${selectedConversation.id.slice(0, 8)}`}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Started {new Date(selectedConversation.created_at).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {messagesData?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.is_bot ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-3 text-sm ${
                        msg.is_bot
                          ? 'glass-card'
                          : 'bg-gradient-chat-user text-primary-foreground'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {messagesData?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No messages in this conversation.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card h-full flex items-center justify-center">
            <CardContent>
              <EmptyState
                icon={MessageSquare}
                title="Select a conversation"
                description="Click a conversation on the left to view its messages."
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
