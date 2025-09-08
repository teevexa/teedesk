import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, FileText, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  messages: Array<{
    id: string;
    content: string;
    sender: 'user' | 'bot';
    created_at: string;
    intent?: string;
    sentiment?: string;
  }>;
}

interface ConversationExportProps {
  conversation: Conversation;
}

export const ConversationExport: React.FC<ConversationExportProps> = ({ conversation }) => {
  const { toast } = useToast();

  const exportAsJSON = () => {
    try {
      const dataStr = JSON.stringify(conversation, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `conversation-${conversation.id}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Conversation exported as JSON file.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export conversation.",
        variant: "destructive"
      });
    }
  };

  const exportAsText = () => {
    try {
      let textContent = `Conversation: ${conversation.title}\n`;
      textContent += `Date: ${new Date(conversation.created_at).toLocaleString()}\n`;
      textContent += `\n--- Messages ---\n\n`;

      conversation.messages.forEach((message) => {
        const timestamp = new Date(message.created_at).toLocaleTimeString();
        const sender = message.sender === 'user' ? 'Customer' : 'AI Support';
        textContent += `[${timestamp}] ${sender}: ${message.content}\n`;
        
        if (message.intent || message.sentiment) {
          textContent += `  Analysis: Intent: ${message.intent || 'N/A'}, Sentiment: ${message.sentiment || 'N/A'}\n`;
        }
        textContent += '\n';
      });

      const dataBlob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `conversation-${conversation.id}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Conversation exported as text file.",
      });
    } catch (error) {
      toast({
        title: "Export Failed", 
        description: "Failed to export conversation.",
        variant: "destructive"
      });
    }
  };

  const shareConversation = async () => {
    try {
      const shareData = {
        title: `Conversation: ${conversation.title}`,
        text: `AI Customer Support conversation from ${new Date(conversation.created_at).toLocaleDateString()}`,
        url: window.location.href
      };

      if (navigator.share) {
        await navigator.share(shareData);
        toast({
          title: "Shared Successfully",
          description: "Conversation link shared.",
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link Copied",
          description: "Conversation link copied to clipboard.",
        });
      }
    } catch (error) {
      toast({
        title: "Share Failed",
        description: "Failed to share conversation.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="glass-card p-4">
      <h3 className="text-lg font-semibold mb-4">Export Conversation</h3>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={exportAsJSON}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportAsText}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Text
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={shareConversation}
          className="flex items-center gap-2"
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </div>
    </Card>
  );
};