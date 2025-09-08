import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Clock, MessageSquare, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dbService, Conversation, Message } from '@/lib/supabase';

interface ConversationWithMessages extends Conversation {
  messages: Message[];
  lastMessage?: Message;
}

export const ConversationHistory: React.FC = () => {
  const [conversations, setConversations] = useState<ConversationWithMessages[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithMessages | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const userConversations = await dbService.getUserConversations('demo_user');
      const conversationsWithMessages = await Promise.all(
        userConversations.map(async (conv) => {
          const messages = await dbService.getConversationHistory(conv.id);
          return {
            ...conv,
            messages,
            lastMessage: messages[messages.length - 1]
          };
        })
      );
      setConversations(conversationsWithMessages);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterBy === 'all') return matchesSearch;
    
    const sentiment = conv.lastMessage?.sentiment;
    return matchesSearch && sentiment === filterBy;
  });

  const getSentimentBadge = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return <Badge className="bg-success text-success-foreground">Positive</Badge>;
      case 'negative':
        return <Badge className="bg-destructive text-destructive-foreground">Negative</Badge>;
      default:
        return <Badge variant="secondary">Neutral</Badge>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Conversations List */}
      <div className="space-y-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Conversations */}
            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {filteredConversations.map((conversation) => (
                <motion.div
                  key={conversation.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card 
                    className={`cursor-pointer transition-all duration-200 ${
                      selectedConversation?.id === conversation.id 
                        ? 'bg-gradient-primary text-primary-foreground' 
                        : 'glass hover:shadow-glow'
                    }`}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium truncate">{conversation.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(conversation.updated_at).toLocaleDateString()}
                        </div>
                      </div>
                      
                      {conversation.lastMessage && (
                        <div className="space-y-2">
                          <p className="text-sm opacity-80 truncate">
                            {conversation.lastMessage.content}
                          </p>
                          <div className="flex justify-between items-center">
                            {getSentimentBadge(conversation.lastMessage.sentiment)}
                            <span className="text-xs opacity-60">
                              {conversation.messages.length} messages
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversation Details */}
      <div>
        {selectedConversation ? (
          <Card className="glass-card h-full">
            <CardHeader>
              <CardTitle>{selectedConversation.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Started {new Date(selectedConversation.created_at).toLocaleString()}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                {selectedConversation.messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl p-3 ${
                        message.sender === 'user'
                          ? 'bg-gradient-chat-user text-primary-foreground'
                          : 'glass-card'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className="flex gap-2 mt-2">
                        {message.intent && (
                          <Badge variant="outline" className="text-xs">
                            {message.intent.replace('_', ' ')}
                          </Badge>
                        )}
                        {message.sentiment && getSentimentBadge(message.sentiment)}
                      </div>
                      <p className="text-xs opacity-60 mt-1">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card h-full flex items-center justify-center">
            <CardContent className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Select a conversation to view details</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};