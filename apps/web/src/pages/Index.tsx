import React, { useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { AnalyticsPanel } from '@/components/analytics/AnalyticsPanel';
import { KnowledgeBase } from '@/components/knowledge/KnowledgeBase';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AgentDashboard } from '@/components/agent/AgentDashboard';
import { useAuthStore } from '@/store/auth.store';
import { useChatStore } from '@/store/chat.store';
import { ADMIN_ROLES } from '@/types';

const Index: React.FC = () => {
  const { user, token } = useAuthStore();
  const { initWS, teardownWS } = useChatStore();

  // Boot WebSocket when the app mounts (user is authenticated at this point)
  useEffect(() => {
    if (token) {
      initWS(token);
    }
    return () => {
      teardownWS();
    };
  }, [token]);

  const isAdmin = user ? ADMIN_ROLES.includes(user.role) : false;

  return (
    <AppLayout
      chatPanel={<ChatInterface />}
      analyticsPanel={<AnalyticsPanel />}
      knowledgePanel={<KnowledgeBase />}
      adminPanel={isAdmin ? <AdminDashboard /> : <AgentDashboard />}
    />
  );
};

export default Index;
