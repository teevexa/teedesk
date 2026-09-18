import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConversationHistory } from '@/components/admin/ConversationHistory';
import { AnalyticsPanel } from '@/components/analytics/AnalyticsPanel';
import { SettingsPanel } from '@/components/admin/SettingsPanel';
import { TrainingDataPanel } from '@/components/admin/TrainingDataPanel';
import { UserManagementPanel } from '@/components/admin/UserManagementPanel';
import {
  Settings,
  MessageSquare,
  BarChart3,
  Database,
  Bot,
  Shield,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  Brain,
} from 'lucide-react';
import { healthService } from '@/services/health.service';
import { useUIStore } from '@/store';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const { isBackendConnected } = useUIStore();

  const { data: health, refetch: recheckHealth, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: healthService.check,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold gradient-text">Admin Dashboard</h1>
        <div className="flex items-center gap-2">
          {isBackendConnected ? (
            <Badge className="bg-success/20 text-success border-success/30">
              <Wifi className="h-3 w-3 mr-1" /> Backend Connected
            </Badge>
          ) : (
            <Badge variant="secondary">
              <WifiOff className="h-3 w-3 mr-1" /> Backend Offline
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass-card flex w-full overflow-x-auto sm:grid sm:grid-cols-5">
          <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
          <TabsTrigger value="conversations" className="flex-shrink-0">Conversations</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-shrink-0">Analytics</TabsTrigger>
          <TabsTrigger value="training" className="flex-shrink-0 gap-1">
            <Brain className="h-3.5 w-3.5" />
            Training
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex-shrink-0">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Service Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Service</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${isBackendConnected ? 'text-success' : 'text-muted-foreground'}`}>
                  {isBackendConnected ? 'Online' : 'Offline'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {health?.version ? `v${health.version}` : 'Not reachable'}
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${health?.services?.database ? 'text-success' : 'text-muted-foreground'}`}>
                  {health?.services?.database ? 'Connected' : 'Not connected'}
                </div>
                <p className="text-xs text-muted-foreground">PostgreSQL + pgvector</p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">LLM Inference</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${health?.services?.llm ? 'text-success' : 'text-muted-foreground'}`}>
                  {health?.services?.llm ? 'Ready' : 'Not ready'}
                </div>
                <p className="text-xs text-muted-foreground">Ollama local inference</p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${
                    health?.secret_key_configured ? 'text-success' : 'text-warning'
                  }`}
                >
                  {health?.secret_key_configured === undefined
                    ? '—'
                    : health.secret_key_configured
                      ? 'Secured'
                      : 'Default Key'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {health?.environment ? `${health.environment} environment` : 'JWT auth'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="flex flex-col gap-2 h-20"
                  onClick={() => recheckHealth()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
                  Recheck Health
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col gap-2 h-20"
                  onClick={() => setActiveTab('conversations')}
                >
                  <Download className="h-5 w-5" />
                  Export Data
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col gap-2 h-20"
                  onClick={() => setActiveTab('analytics')}
                >
                  <BarChart3 className="h-5 w-5" />
                  Reports
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col gap-2 h-20"
                  onClick={() => setUserPanelOpen(true)}
                >
                  <Shield className="h-5 w-5" />
                  User Management
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Implementation Status */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">Implementation Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                {[
                  { label: 'Monorepo architecture (Turborepo + npm)', done: true },
                  { label: 'React frontend — chat UI + admin dashboard', done: true },
                  { label: 'Zustand state management', done: true },
                  { label: 'FastAPI backend (REST + WebSocket)', done: true },
                  { label: 'PostgreSQL 16 + pgvector database', done: true },
                  { label: 'Alembic migrations', done: true },
                  { label: 'JWT authentication (login + refresh + reset)', done: true },
                  { label: 'Multi-tenancy — tenant-scoped data + RBAC', done: true },
                  { label: 'Ollama LLM integration (Mistral 7B)', done: true },
                  { label: 'Sentence-transformer intent classification', done: true },
                  { label: 'spaCy NER pipeline', done: true },
                  { label: 'Sentiment analysis (auto-escalation)', done: true },
                  { label: 'RAG pipeline (embed → retrieve → generate)', done: true },
                  { label: 'Human handoff queue (agent claim + resolve)', done: true },
                  { label: 'Real-time WebSocket chat', done: true },
                  { label: 'Voice input / output (Web Speech API)', done: true },
                  { label: 'Analytics API (sentiment, intents, trends)', done: true },
                  { label: 'Knowledge base (upload, embed, search)', done: true },
                  { label: 'Docker Compose dev infrastructure', done: true },
                  { label: 'CI/CD pipeline (GitHub Actions)', done: true },
                  { label: 'Embeddable chat widget (IIFE bundle)', done: true },
                  { label: 'WhatsApp Business API integration', done: true },
                  { label: 'Fine-tuning pipeline (Celery + feedback loop)', done: true },
                  { label: 'Telegram bot integration', done: true },
                  { label: 'File attachments (upload/download)', done: true },
                  { label: 'Knowledge base PDF/DOCX ingestion', done: true },
                  { label: 'Billing (Stripe / Flutterwave)', done: false },
                ].map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={done ? 'text-success' : 'text-muted-foreground'}>
                      {done ? '✓' : '○'}
                    </span>
                    <span className={done ? '' : 'text-muted-foreground'}>{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversations">
          <ConversationHistory />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsPanel />
        </TabsContent>

        <TabsContent value="training">
          <TrainingDataPanel />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsPanel />
        </TabsContent>
      </Tabs>

      <UserManagementPanel open={userPanelOpen} onOpenChange={setUserPanelOpen} />
    </div>
  );
};
