import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatInterface } from '@/components/ChatInterface';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { AdminDashboard } from '@/components/AdminDashboard';
import { MessageCircle, BarChart3, Settings } from 'lucide-react';

const Index = () => {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="h-screen bg-gradient-secondary">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        {/* Navigation Header */}
        <div className="glass-card border-0 border-b rounded-none">
          <TabsList className="h-16 w-full bg-transparent justify-start gap-1 p-4">
            <TabsTrigger 
              value="chat" 
              className="flex items-center gap-2 px-6 py-3 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              Customer Support
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="flex items-center gap-2 px-6 py-3 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
            >
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="admin" 
              className="flex items-center gap-2 px-6 py-3 data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground"
            >
              <Settings className="h-4 w-4" />
              Admin Dashboard
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          <TabsContent value="chat" className="h-full m-0 overflow-hidden">
            <ChatInterface />
          </TabsContent>
          
          <TabsContent value="analytics" className="h-full m-0 p-6">
            <AnalyticsPanel />
          </TabsContent>
          
          <TabsContent value="admin" className="h-full m-0 p-6">
            <AdminDashboard />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default Index;