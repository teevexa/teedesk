import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Mic, MicOff, Volume2, VolumeX, Bot, User, ThumbsUp, ThumbsDown, ShoppingCart, Laptop, CreditCard, Heart, Phone, Plane, Car, UtensilsCrossed, Play, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { aiService, AIAnalysis } from '@/lib/ai-services';
import { dbService, Message, Conversation } from '@/lib/supabase';
import { voiceService } from '@/lib/voice-service';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage extends Message {
  analysis?: AIAnalysis;
  isTyping?: boolean;
}

interface SupportCategory {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
  examples: string[];
  color: string;
}

const supportCategories: SupportCategory[] = [
  {
    id: 'ecommerce',
    name: 'E-commerce & Retail',
    icon: ShoppingCart,
    description: 'Order tracking, returns, refunds, product inquiries',
    examples: ['Track my order', 'Return policy', 'Product availability'],
    color: 'text-blue-500'
  },
  {
    id: 'technology',
    name: 'Technology & Software',
    icon: Laptop,
    description: 'Technical support, software issues, device setup',
    examples: ['Login problems', 'Software bugs', 'Device configuration'],
    color: 'text-green-500'
  },
  {
    id: 'banking',
    name: 'Banking & Finance',
    icon: CreditCard,
    description: 'Account issues, transactions, payment methods',
    examples: ['Payment failed', 'Account access', 'Transaction dispute'],
    color: 'text-yellow-500'
  },
  {
    id: 'healthcare',
    name: 'Healthcare & Insurance',
    icon: Heart,
    description: 'Appointments, insurance claims, medical records',
    examples: ['Book appointment', 'Insurance coverage', 'Medical records'],
    color: 'text-red-500'
  },
  {
    id: 'telecom',
    name: 'Telecommunications',
    icon: Phone,
    description: 'Service plans, billing, network issues',
    examples: ['Service outage', 'Plan changes', 'Billing inquiry'],
    color: 'text-purple-500'
  },
  {
    id: 'travel',
    name: 'Travel & Hospitality',
    icon: Plane,
    description: 'Bookings, cancellations, travel assistance',
    examples: ['Flight changes', 'Hotel booking', 'Travel insurance'],
    color: 'text-indigo-500'
  },
  {
    id: 'automotive',
    name: 'Automotive & Transportation',
    icon: Car,
    description: 'Vehicle services, ride booking, maintenance',
    examples: ['Ride booking', 'Vehicle maintenance', 'Service appointments'],
    color: 'text-orange-500'
  },
  {
    id: 'food',
    name: 'Food & Delivery Services',
    icon: UtensilsCrossed,
    description: 'Order delivery, restaurant issues, food quality',
    examples: ['Order status', 'Wrong order', 'Delivery issues'],
    color: 'text-pink-500'
  },
  {
    id: 'streaming',
    name: 'Streaming & Entertainment',
    icon: Play,
    description: 'Subscriptions, content issues, playback problems',
    examples: ['Streaming quality', 'Subscription billing', 'Content access'],
    color: 'text-cyan-500'
  },
  {
    id: 'social',
    name: 'Social Media & Communication',
    icon: MessageCircle,
    description: 'Account security, privacy settings, platform issues',
    examples: ['Account recovery', 'Privacy settings', 'Content moderation'],
    color: 'text-emerald-500'
  }
];

export const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isAIInitialized, setIsAIInitialized] = useState(false);
  const [showCategories, setShowCategories] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    initializeChat();
    scrollToBottom();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeChat = async () => {
    try {
      setIsLoading(true);
      
      // Initialize AI services
      await aiService.initialize();
      setIsAIInitialized(true);
      
      // Create a new conversation
      const newConversation = await dbService.createConversation('demo_user', 'AI Support Chat');
      setConversation(newConversation);
      
      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        conversation_id: newConversation.id,
        content: "🤖 Hello! I'm your AI customer support assistant.\n\nI can help you with questions across 10 major categories. Choose a category below or type your question directly. I'm trained to assist with:\n\n• E-commerce & Retail (orders, returns, refunds)\n• Technology & Software (tech support, bugs)\n• Banking & Finance (payments, accounts)\n• Healthcare & Insurance (appointments, claims)\n• Telecommunications (billing, service issues)\n• Travel & Hospitality (bookings, cancellations)\n• Automotive & Transportation (rides, maintenance)\n• Food & Delivery (orders, delivery issues)\n• Streaming & Entertainment (subscriptions, playback)\n• Social Media & Communication (security, privacy)\n\nHow can I assist you today?",
        sender: 'bot',
        created_at: new Date().toISOString()
      };
      
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      toast({
        title: "Initialization Error",
        description: "Failed to initialize AI services. Some features may be limited.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !conversation || isLoading) return;

    // Hide categories after first message
    handleFirstMessage();

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      conversation_id: conversation.id,
      content: inputValue.trim(),
      sender: 'user',
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Save user message to database
      await dbService.saveMessage(userMessage);

      // Add typing indicator
      const typingMessage: ChatMessage = {
        id: 'typing',
        conversation_id: conversation.id,
        content: '',
        sender: 'bot',
        created_at: new Date().toISOString(),
        isTyping: true
      };
      setMessages(prev => [...prev, typingMessage]);

      // Analyze user message with AI
      let analysis: AIAnalysis | undefined;
      if (isAIInitialized) {
        analysis = await aiService.analyzeText(userMessage.content);
      }

      // Generate response
      const responseContent = isAIInitialized 
        ? aiService.generateResponse(analysis!, userMessage.content)
        : "I'm here to help! However, AI services are still loading. Please try again in a moment.";

      // Remove typing indicator and add bot response
      setMessages(prev => prev.filter(msg => msg.id !== 'typing'));

      const botMessage: ChatMessage = {
        id: `bot_${Date.now()}`,
        conversation_id: conversation.id,
        content: responseContent,
        sender: 'bot',
        intent: analysis?.intent.intent,
        sentiment: analysis?.sentiment.label,
        entities: analysis?.entities,
        created_at: new Date().toISOString(),
        analysis
      };

      setMessages(prev => [...prev, botMessage]);

      // Save bot message to database
      await dbService.saveMessage(botMessage);

    } catch (error) {
      console.error('Error processing message:', error);
      toast({
        title: "Error",
        description: "Failed to process your message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceInput = async () => {
    if (!voiceService.isSpeechRecognitionSupported()) {
      toast({
        title: "Voice Not Supported",
        description: "Speech recognition is not supported in your browser.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsListening(true);
      const transcript = await voiceService.startListening();
      setInputValue(transcript);
      toast({
        title: "Voice Input Captured",
        description: `"${transcript}"`,
      });
    } catch (error) {
      console.error('Voice input error:', error);
      toast({
        title: "Voice Input Error",
        description: "Failed to capture voice input. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsListening(false);
    }
  };

  const handleSpeakMessage = async (content: string) => {
    if (!voiceService.isSpeechSynthesisSupported()) {
      toast({
        title: "Speech Not Supported",
        description: "Text-to-speech is not supported in your browser.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSpeaking(true);
      await voiceService.speak(content);
    } catch (error) {
      console.error('Speech error:', error);
      toast({
        title: "Speech Error",
        description: "Failed to speak the message.",
        variant: "destructive"
      });
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleFeedback = async (messageId: string, rating: 'positive' | 'negative') => {
    try {
      await dbService.saveFeedback({ message_id: messageId, rating });
      toast({
        title: "Feedback Received",
        description: "Thank you for your feedback!",
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const handleCategorySelect = (category: SupportCategory) => {
    const exampleQuestion = category.examples[Math.floor(Math.random() * category.examples.length)];
    setInputValue(exampleQuestion);
    setShowCategories(false);
    inputRef.current?.focus();
  };

  const handleFirstMessage = () => {
    setShowCategories(false);
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-success';
      case 'negative': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const getIntentColor = (intent?: string) => {
    switch (intent) {
      case 'order_tracking': return 'bg-accent';
      case 'refund_request': return 'bg-warning';
      case 'complaint': return 'bg-destructive';
      case 'support_request': return 'bg-primary';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="flex flex-col h-full max-h-full">
      {/* Support Categories */}
      {showCategories && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="p-4 bg-gradient-to-b from-background to-background/80 border-b"
        >
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">What can I help you with today?</h3>
            <p className="text-sm text-muted-foreground">Choose a category or type your question directly</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {supportCategories.map((category) => {
              const IconComponent = category.icon;
              return (
                <motion.button
                  key={category.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleCategorySelect(category)}
                  className="glass-card p-3 text-left hover:shadow-glow transition-all duration-300 group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <IconComponent className={`h-5 w-5 ${category.color} group-hover:scale-110 transition-transform`} />
                    <span className="font-medium text-xs">{category.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {category.examples.length} examples
                    </Badge>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 min-h-0">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.sender === 'bot' && (
                <div className="flex-shrink-0 p-2 rounded-full bg-gradient-primary shadow-glow">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
              
              <div className={`max-w-[80%] ${message.sender === 'user' ? 'order-2' : ''}`}>
                <div
                  className={`rounded-2xl p-4 shadow-chat ${
                    message.sender === 'user'
                      ? 'bg-gradient-chat-user text-primary-foreground ml-auto'
                      : 'glass-card'
                  }`}
                >
                  {message.isTyping ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                      <span className="text-sm text-muted-foreground">AI is thinking...</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      
                      {/* AI Analysis Badges */}
                      {message.analysis && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getIntentColor(message.analysis.intent.intent)}`}
                          >
                            {message.analysis.intent.intent.replace('_', ' ')}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getSentimentColor(message.analysis.sentiment.label)}`}
                          >
                            {message.analysis.sentiment.label}
                          </Badge>
                        </div>
                      )}
                      
                      {/* Message Actions */}
                      {message.sender === 'bot' && !message.isTyping && (
                        <div className="flex items-center gap-2 mt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSpeakMessage(message.content)}
                            disabled={isSpeaking}
                            className="h-8 w-8 p-0"
                          >
                            {isSpeaking ? (
                              <VolumeX className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeedback(message.id, 'positive')}
                            className="h-8 w-8 p-0"
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleFeedback(message.id, 'negative')}
                            className="h-8 w-8 p-0"
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                
                <p className="text-xs text-muted-foreground mt-1 px-3">
                  {new Date(message.created_at).toLocaleTimeString()}
                </p>
              </div>
              
              {message.sender === 'user' && (
                <div className="flex-shrink-0 p-2 rounded-full bg-gradient-chat-user">
                  <User className="h-5 w-5 text-primary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass-card border-0 border-t rounded-none p-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your message..."
              disabled={isLoading}
              className="glass bg-input-glass border-border/30 focus:border-primary resize-none"
            />
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleVoiceInput}
            disabled={isListening || isLoading}
            className={`glass-card ${isListening ? 'glow-primary' : ''}`}
          >
            {isListening ? (
              <MicOff className="h-4 w-4 text-destructive" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};