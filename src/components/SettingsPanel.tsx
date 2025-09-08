import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, Bot, Volume2, Globe, Shield, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SettingsState {
  general: {
    chatTitle: string;
    welcomeMessage: string;
    businessHours: string;
    timeZone: string;
    language: string;
  };
  ai: {
    enableSentimentAnalysis: boolean;
    enableIntentDetection: boolean;
    enableVoiceSupport: boolean;
    responseDelay: number;
    confidenceThreshold: number;
    autoEscalation: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    smsAlerts: boolean;
    desktopNotifications: boolean;
    urgentIssueAlert: boolean;
  };
  integrations: {
    whatsappEnabled: boolean;
    telegramEnabled: boolean;
    slackIntegration: boolean;
    webhookUrl: string;
  };
}

const defaultSettings: SettingsState = {
  general: {
    chatTitle: 'AI Customer Support',
    welcomeMessage: 'Hello! How can I help you today?',
    businessHours: '9:00 AM - 6:00 PM',
    timeZone: 'UTC-5',
    language: 'en'
  },
  ai: {
    enableSentimentAnalysis: true,
    enableIntentDetection: true,
    enableVoiceSupport: true,
    responseDelay: 1000,
    confidenceThreshold: 0.7,
    autoEscalation: true
  },
  notifications: {
    emailNotifications: true,
    smsAlerts: false,
    desktopNotifications: true,
    urgentIssueAlert: true
  },
  integrations: {
    whatsappEnabled: false,
    telegramEnabled: false,
    slackIntegration: false,
    webhookUrl: ''
  }
};

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const updateSetting = (category: keyof SettingsState, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const saveSettings = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Settings Saved",
        description: "Your settings have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    toast({
      title: "Settings Reset",
      description: "All settings have been reset to defaults.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-primary">
          <Settings className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold gradient-text">System Settings</h2>
          <p className="text-sm text-muted-foreground">Configure your AI chatbot preferences</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Settings
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-semibold">General Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="chatTitle">Chat Title</Label>
                <Input
                  id="chatTitle"
                  value={settings.general.chatTitle}
                  onChange={(e) => updateSetting('general', 'chatTitle', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="businessHours">Business Hours</Label>
                <Input
                  id="businessHours"
                  value={settings.general.businessHours}
                  onChange={(e) => updateSetting('general', 'businessHours', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timeZone">Time Zone</Label>
                <Select 
                  value={settings.general.timeZone}
                  onValueChange={(value) => updateSetting('general', 'timeZone', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC-8">UTC-8 (PST)</SelectItem>
                    <SelectItem value="UTC-5">UTC-5 (EST)</SelectItem>
                    <SelectItem value="UTC+0">UTC+0 (GMT)</SelectItem>
                    <SelectItem value="UTC+1">UTC+1 (CET)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={settings.general.language}
                  onValueChange={(value) => updateSetting('general', 'language', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                value={settings.general.welcomeMessage}
                onChange={(e) => updateSetting('general', 'welcomeMessage', e.target.value)}
                rows={3}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-semibold">AI Configuration</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sentimentAnalysis">Sentiment Analysis</Label>
                  <p className="text-sm text-muted-foreground">Analyze customer emotions in real-time</p>
                </div>
                <Switch
                  id="sentimentAnalysis"
                  checked={settings.ai.enableSentimentAnalysis}
                  onCheckedChange={(checked) => updateSetting('ai', 'enableSentimentAnalysis', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="intentDetection">Intent Detection</Label>
                  <p className="text-sm text-muted-foreground">Automatically classify customer requests</p>
                </div>
                <Switch
                  id="intentDetection"
                  checked={settings.ai.enableIntentDetection}
                  onCheckedChange={(checked) => updateSetting('ai', 'enableIntentDetection', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="voiceSupport">Voice Support</Label>
                  <p className="text-sm text-muted-foreground">Enable speech-to-text and text-to-speech</p>
                </div>
                <Switch
                  id="voiceSupport"
                  checked={settings.ai.enableVoiceSupport}
                  onCheckedChange={(checked) => updateSetting('ai', 'enableVoiceSupport', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoEscalation">Auto Escalation</Label>
                  <p className="text-sm text-muted-foreground">Escalate urgent issues automatically</p>
                </div>
                <Switch
                  id="autoEscalation"
                  checked={settings.ai.autoEscalation}
                  onCheckedChange={(checked) => updateSetting('ai', 'autoEscalation', checked)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="responseDelay">Response Delay (ms)</Label>
                <Input
                  id="responseDelay"
                  type="number"
                  value={settings.ai.responseDelay}
                  onChange={(e) => updateSetting('ai', 'responseDelay', parseInt(e.target.value))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confidenceThreshold">Confidence Threshold</Label>
                <Input
                  id="confidenceThreshold"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={settings.ai.confidenceThreshold}
                  onChange={(e) => updateSetting('ai', 'confidenceThreshold', parseFloat(e.target.value))}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-semibold">Notification Preferences</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={settings.notifications.emailNotifications}
                  onCheckedChange={(checked) => updateSetting('notifications', 'emailNotifications', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="smsAlerts">SMS Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get urgent alerts via SMS</p>
                </div>
                <Switch
                  id="smsAlerts"
                  checked={settings.notifications.smsAlerts}
                  onCheckedChange={(checked) => updateSetting('notifications', 'smsAlerts', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="desktopNotifications">Desktop Notifications</Label>
                  <p className="text-sm text-muted-foreground">Show browser notifications</p>
                </div>
                <Switch
                  id="desktopNotifications"
                  checked={settings.notifications.desktopNotifications}
                  onCheckedChange={(checked) => updateSetting('notifications', 'desktopNotifications', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="urgentIssueAlert">Urgent Issue Alerts</Label>
                  <p className="text-sm text-muted-foreground">Immediate alerts for critical issues</p>
                </div>
                <Switch
                  id="urgentIssueAlert"
                  checked={settings.notifications.urgentIssueAlert}
                  onCheckedChange={(checked) => updateSetting('notifications', 'urgentIssueAlert', checked)}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card className="glass-card p-6 space-y-6">
            <h3 className="text-lg font-semibold">Third-party Integrations</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">WhatsApp</Badge>
                  <div>
                    <Label htmlFor="whatsappEnabled">WhatsApp Integration</Label>
                    <p className="text-sm text-muted-foreground">Connect with WhatsApp Business API</p>
                  </div>
                </div>
                <Switch
                  id="whatsappEnabled"
                  checked={settings.integrations.whatsappEnabled}
                  onCheckedChange={(checked) => updateSetting('integrations', 'whatsappEnabled', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Telegram</Badge>
                  <div>
                    <Label htmlFor="telegramEnabled">Telegram Bot</Label>
                    <p className="text-sm text-muted-foreground">Enable Telegram bot support</p>
                  </div>
                </div>
                <Switch
                  id="telegramEnabled"
                  checked={settings.integrations.telegramEnabled}
                  onCheckedChange={(checked) => updateSetting('integrations', 'telegramEnabled', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">Slack</Badge>
                  <div>
                    <Label htmlFor="slackIntegration">Slack Integration</Label>
                    <p className="text-sm text-muted-foreground">Send notifications to Slack</p>
                  </div>
                </div>
                <Switch
                  id="slackIntegration"
                  checked={settings.integrations.slackIntegration}
                  onCheckedChange={(checked) => updateSetting('integrations', 'slackIntegration', checked)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                placeholder="https://your-server.com/webhook"
                value={settings.integrations.webhookUrl}
                onChange={(e) => updateSetting('integrations', 'webhookUrl', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                URL to receive conversation events and analytics data
              </p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex items-center gap-4">
        <Button 
          onClick={saveSettings} 
          disabled={isLoading}
          className="bg-gradient-primary"
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button 
          variant="outline" 
          onClick={resetSettings}
          disabled={isLoading}
        >
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
};