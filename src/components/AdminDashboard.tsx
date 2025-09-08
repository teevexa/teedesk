import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { ConversationHistory } from '@/components/ConversationHistory';
import { 
  Settings, 
  MessageSquare, 
  BarChart3, 
  Database, 
  Bot, 
  Users, 
  Shield,
  Download,
  Upload,
  RefreshCw
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold gradient-text">Admin Dashboard</h1>
        <Badge className="bg-gradient-primary text-primary-foreground">
          Production Ready
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 glass-card">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* System Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Services</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">Active</div>
                <p className="text-xs text-muted-foreground">
                  NLP models loaded
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">Connected</div>
                <p className="text-xs text-muted-foreground">
                  Mock service running
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Voice Support</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">Available</div>
                <p className="text-xs text-muted-foreground">
                  Speech API ready
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Security</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">Demo Mode</div>
                <p className="text-xs text-muted-foreground">
                  Enable auth for production
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" className="flex flex-col gap-2 h-20">
                  <RefreshCw className="h-5 w-5" />
                  Restart AI
                </Button>
                <Button variant="outline" className="flex flex-col gap-2 h-20">
                  <Download className="h-5 w-5" />
                  Export Data
                </Button>
                <Button variant="outline" className="flex flex-col gap-2 h-20">
                  <Upload className="h-5 w-5" />
                  Import Config
                </Button>
                <Button variant="outline" className="flex flex-col gap-2 h-20">
                  <Users className="h-5 w-5" />
                  User Management
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span>AI services initialized successfully</span>
                  <span className="text-muted-foreground ml-auto">Just now</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-accent"></div>
                  <span>New conversation started</span>
                  <span className="text-muted-foreground ml-auto">2 min ago</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  <span>Voice service activated</span>
                  <span className="text-muted-foreground ml-auto">5 min ago</span>
                </div>
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

        <TabsContent value="settings" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">AI Model Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Intent Detection</label>
                    <p className="text-sm">Rule-based + Transformers</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Sentiment Analysis</label>
                    <p className="text-sm">RoBERTa Base</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-medium">Database Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Currently using mock database service. Connect to Supabase for production deployment.
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Integration Status</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm">Voice Support</span>
                    <Badge className="bg-success text-success-foreground">Active</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">WhatsApp API</span>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Telegram Bot</span>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};